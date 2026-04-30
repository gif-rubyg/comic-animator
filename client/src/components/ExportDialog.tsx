import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeLayerState } from "@/lib/animationEngine";
import { toast } from "sonner";
import { Download, Loader2, Music, Volume2 } from "lucide-react";

interface Props {
  project: { id: number; name: string; aspectRatio: string; bgMusicUrl?: string | null; bgMusicVolume?: number };
  panels: any[];
  onClose: () => void;
}

/** Stable image cache */
const imgCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgCache.set(src, img); resolve(img); };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Fetch audio buffer from URL via Web Audio API */
async function loadAudioBuffer(url: string, audioCtx: AudioContext): Promise<AudioBuffer | null> {
  try {
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  }
}

/** Fetch layers for all panels */
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

/** Draw speech bubbles onto canvas context */
function drawSpeechBubbles(ctx: CanvasRenderingContext2D, bubbles: any[], exportW: number, exportH: number) {
  if (!bubbles?.length) return;
  for (const bubble of bubbles) {
    const bx = (bubble.x / 100) * exportW;
    const by = (bubble.y / 100) * exportH;
    const bw = (bubble.width / 100) * exportW;
    const bh = (bubble.height / 100) * exportH;
    const fontSize = Math.round((bubble.fontSize / 360) * exportW);

    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;

    // Draw bubble background
    ctx.fillStyle = bubble.fillColor || "#ffffff";
    ctx.strokeStyle = bubble.borderColor || "#000000";
    ctx.lineWidth = Math.max(2, exportW / 360);

    if (bubble.style === "thought") {
      // Oval thought bubble
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (bubble.style === "shout") {
      // Jagged shout bubble
      const cx = bx + bw / 2, cy = by + bh / 2;
      const spikes = 8;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const r = i % 2 === 0 ? Math.max(bw, bh) / 2 : Math.max(bw, bh) / 2.8;
        ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Standard rounded rect speech bubble
      const r = Math.min(bw, bh) * 0.15;
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bw - r, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
      ctx.lineTo(bx + bw, by + bh - r);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
      ctx.lineTo(bx + r, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Tail
      const tailDir = bubble.tailDirection || "bottom-left";
      const tx = tailDir.includes("right") ? bx + bw * 0.75 : bx + bw * 0.25;
      const ty = by + bh;
      ctx.beginPath();
      ctx.moveTo(tx - bw * 0.08, ty);
      ctx.lineTo(tx + bw * 0.08, ty);
      ctx.lineTo(tx + (tailDir.includes("right") ? bw * 0.2 : -bw * 0.2), ty + bh * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Draw text
    ctx.fillStyle = bubble.textColor || "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = (bubble.text || "").split("\n");
    const lineH = fontSize * 1.3;
    const startY = by + bh / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line: string, i: number) => {
      ctx.fillText(line, bx + bw / 2, startY + i * lineH);
    });

    ctx.restore();
  }
}

export default function ExportDialog({ project, panels, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [fps, setFps] = useState("24");
  const [quality, setQuality] = useState("high");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const is916 = project.aspectRatio === "9:16";
  const exportW = is916 ? 1080 : 1280;
  const exportH = is916 ? 1920 : 960;

  const hasAudio = panels.some(p => p.audioUrl) || !!project.bgMusicUrl;

  const exportReel = useCallback(async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    setExportProgress(0);
    setExportStatus("Preparing...");

    try {
      const canvas = canvasRef.current;
      canvas.width = exportW;
      canvas.height = exportH;
      const ctx = canvas.getContext("2d")!;

      setExportStatus("Fetching layers...");
      const allLayers = await fetchAllLayers(panels);

      setExportStatus("Preloading images...");
      const allUrls = new Set<string>();
      panels.forEach(p => { if (p.backgroundUrl) allUrls.add(p.backgroundUrl); });
      Object.values(allLayers).flat().forEach((l: any) => { if (l.imageUrl) allUrls.add(l.imageUrl); });
      await Promise.allSettled(Array.from(allUrls).map(url => loadImage(url)));

      const fpsNum = parseInt(fps);

      // --- Audio Setup ---
      let audioCtx: AudioContext | null = null;
      let audioDestination: MediaStreamAudioDestinationNode | null = null;
      const panelAudioSources: Array<{ buffer: AudioBuffer | null; startOffset: number; volume: number }> = [];
      let bgMusicBuffer: AudioBuffer | null = null;

      if (hasAudio) {
        setExportStatus("Loading audio...");
        audioCtx = new AudioContext();
        audioDestination = audioCtx.createMediaStreamDestination();

        // Load BG music
        if (project.bgMusicUrl) {
          bgMusicBuffer = await loadAudioBuffer(project.bgMusicUrl, audioCtx);
        }

        // Load panel audio with start offsets
        let timeOffset = 0;
        for (const panel of panels) {
          const buf = panel.audioUrl ? await loadAudioBuffer(panel.audioUrl, audioCtx) : null;
          panelAudioSources.push({ buffer: buf, startOffset: timeOffset, volume: panel.audioVolume ?? 1 });
          timeOffset += panel.duration || 3;
        }
      }

      // --- Video stream ---
      const videoStream = canvas.captureStream(fpsNum);
      let combinedStream: MediaStream;

      if (audioCtx && audioDestination) {
        // Mix audio into stream
        const totalDur = panels.reduce((s, p) => s + (p.duration || 3), 0);

        // Schedule BG music
        if (bgMusicBuffer) {
          const bgGain = audioCtx.createGain();
          bgGain.gain.value = project.bgMusicVolume ?? 0.8;
          bgGain.connect(audioDestination);
          const bgSrc = audioCtx.createBufferSource();
          bgSrc.buffer = bgMusicBuffer;
          bgSrc.loop = bgMusicBuffer.duration < totalDur;
          bgSrc.connect(bgGain);
          bgSrc.start(audioCtx.currentTime);
        }

        // Schedule panel audio
        for (const { buffer, startOffset, volume } of panelAudioSources) {
          if (!buffer) continue;
          const gain = audioCtx.createGain();
          gain.gain.value = volume;
          gain.connect(audioDestination);
          const src = audioCtx.createBufferSource();
          src.buffer = buffer;
          src.connect(gain);
          src.start(audioCtx.currentTime + startOffset);
        }

        // Combine video + audio tracks
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ]);
      } else {
        combinedStream = videoStream;
      }

      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: quality === "high" ? 8000000 : quality === "medium" ? 4000000 : 2000000,
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const totalDuration = panels.reduce((sum, p) => sum + (p.duration || 3), 0);
      let elapsed = 0;

      setExportStatus("Rendering frames...");

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

          ctx.clearRect(0, 0, exportW, exportH);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, exportW, exportH);

          // Background
          if (panel.backgroundUrl) {
            const bg = imgCache.get(panel.backgroundUrl);
            if (bg) ctx.drawImage(bg, 0, 0, exportW, exportH);
          }

          // Character layers
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

          // Speech bubbles
          if (panel.speechBubbles?.length) {
            drawSpeechBubbles(ctx, panel.speechBubbles, exportW, exportH);
          }

          setExportProgress(Math.min(99, (elapsed / totalDuration) * 100));

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

      if (audioCtx) audioCtx.close();

      setExportStatus("Saving file...");
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, "-")}-reel.webm`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportStatus("Done!");
      toast.success("Reel exported! Check your downloads.");
      setTimeout(onClose, 1500);
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [panels, fps, quality, exportW, exportH, project.name, project.bgMusicUrl, project.bgMusicVolume, hasAudio]);

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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Audio</span>
              <span className={`font-medium flex items-center gap-1 ${hasAudio ? "text-green-500" : "text-muted-foreground"}`}>
                {hasAudio ? <><Music className="w-3 h-3" /> Included</> : <><Volume2 className="w-3 h-3" /> None</>}
              </span>
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
                <span>{exportStatus}</span>
                <span>{exportProgress.toFixed(0)}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Output: WebM video{hasAudio ? " with audio" : ""} — supported by all major platforms. Downloads automatically when ready.
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
