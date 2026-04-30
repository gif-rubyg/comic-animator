import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { computeLayerState } from "@/lib/animationEngine";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

interface Props {
  project: { id: number; name: string; aspectRatio: string };
  panels: any[];
  onClose: () => void;
}

/** Stable image cache — avoids reloading images on every frame */
const imgCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgCache.set(src, img); resolve(img); };
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

/** Fetch layers for all panels in one shot — no hooks in loops */
async function fetchAllLayers(panels: any[]): Promise<Record<number, any[]>> {
  const result: Record<number, any[]> = {};
  await Promise.all(
    panels.map(async (panel) => {
      try {
        const resp = await fetch(`/api/trpc/layers.list?input=${encodeURIComponent(JSON.stringify({ json: { panelId: panel.id } }))}`);
        const json = await resp.json();
        result[panel.id] = json?.result?.data?.json || [];
      } catch {
        result[panel.id] = [];
      }
    })
  );
  return result;
}

export default function ExportDialog({ project, panels, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [fps, setFps] = useState("24");
  const [quality, setQuality] = useState("high");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const is916 = project.aspectRatio === "9:16";
  const exportW = is916 ? 1080 : 1280;
  const exportH = is916 ? 1920 : 960;

  const exportReel = useCallback(async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    setExportProgress(0);

    try {
      const canvas = canvasRef.current;
      canvas.width = exportW;
      canvas.height = exportH;
      const ctx = canvas.getContext("2d")!;

      // Step 1: Fetch all layers upfront
      const allLayers = await fetchAllLayers(panels);

      // Step 2: Preload all images
      const allUrls = new Set<string>();
      panels.forEach(p => { if (p.backgroundUrl) allUrls.add(p.backgroundUrl); });
      Object.values(allLayers).flat().forEach((l: any) => { if (l.imageUrl) allUrls.add(l.imageUrl); });
      await Promise.allSettled(Array.from(allUrls).map(url => loadImage(url)));

      const fpsNum = parseInt(fps);
      const stream = canvas.captureStream(fpsNum);
      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: quality === "high" ? 8000000 : quality === "medium" ? 4000000 : 2000000,
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const totalDuration = panels.reduce((sum, p) => sum + (p.duration || 3), 0);
      let elapsed = 0;

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.start();

        let panelIdx = 0;
        let panelTime = 0;
        let lastTs = 0;

        const renderFrame = (ts: number) => {
          const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / fpsNum;
          lastTs = ts;
          elapsed += dt;
          panelTime += dt;

          const panel = panels[panelIdx];
          if (!panel) { recorder.stop(); return; }

          const layers = allLayers[panel.id] || [];

          // Clear
          ctx.clearRect(0, 0, exportW, exportH);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, exportW, exportH);

          // Background (from cache — synchronous)
          if (panel.backgroundUrl) {
            const bg = imgCache.get(panel.backgroundUrl);
            if (bg) ctx.drawImage(bg, 0, 0, exportW, exportH);
          }

          // Layers (from cache — synchronous)
          const sortedLayers = [...layers].sort((a: any, b: any) => a.zIndex - b.zIndex);
          for (const layer of sortedLayers as any[]) {
            if (!layer.imageUrl) continue;
            const img = imgCache.get(layer.imageUrl);
            if (!img) continue;

            const lx = (layer.x / 100) * exportW;
            const ly = (layer.y / 100) * exportH;
            const lw = (layer.width / 100) * exportW;
            const lh = (layer.height / 100) * exportH;
            const state = computeLayerState(panelTime, layer.animations || [], exportW);

            ctx.save();
            ctx.globalAlpha = state.opacity;
            ctx.translate(lx + lw / 2 + state.translateX, ly + lh + state.translateY);
            ctx.rotate((state.rotate * Math.PI) / 180);
            ctx.scale(state.scaleX * (layer.flipX ? -1 : 1), state.scaleY);
            ctx.transform(1, Math.tan((state.skewY * Math.PI) / 180), Math.tan((state.skewX * Math.PI) / 180), 1, 0, 0);
            ctx.drawImage(img, -lw / 2, -lh, lw, lh);
            ctx.restore();
          }

          setExportProgress(Math.min(99, (elapsed / totalDuration) * 100));

          // Advance panel
          if (panelTime >= panel.duration) {
            panelIdx++;
            panelTime = 0;
          }

          if (panelIdx < panels.length) {
            requestAnimationFrame(renderFrame);
          } else {
            recorder.stop();
          }
        };

        requestAnimationFrame(renderFrame);
      });

      // Download
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, "-")}-reel.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      toast.success("Reel exported! Check your downloads.");
      setTimeout(onClose, 1500);
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [panels, fps, quality, exportW, exportH, project.name]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Reel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Format</span>
              <span className="font-medium">{project.aspectRatio} ({exportW}×{exportH})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Panels</span>
              <span className="font-medium">{panels.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Duration</span>
              <span className="font-medium">{panels.reduce((s, p) => s + (p.duration || 3), 0)}s</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Frame Rate</Label>
              <Select value={fps} onValueChange={setFps}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 fps</SelectItem>
                  <SelectItem value="30">30 fps</SelectItem>
                  <SelectItem value="60">60 fps</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quality</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (2 Mbps)</SelectItem>
                  <SelectItem value="medium">Medium (4 Mbps)</SelectItem>
                  <SelectItem value="high">High (8 Mbps)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {exporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Rendering frames...</span>
                <span>{exportProgress.toFixed(0)}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Output: WebM video (supported by all major platforms). Downloads automatically when ready.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={exporting}>Cancel</Button>
          <Button onClick={exportReel} disabled={exporting || panels.length === 0} className="gap-2">
            {exporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Exporting...</>
            ) : (
              <><Download className="w-4 h-4" />Export Video</>
            )}
          </Button>
        </DialogFooter>

        {/* Hidden canvas for rendering */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
