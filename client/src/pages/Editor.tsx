import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Film, Plus, Trash2, ArrowLeft, Upload, Play, Pause,
  Layers, Settings, ChevronUp, ChevronDown, FlipHorizontal,
  Download, Eye, EyeOff, Globe, MessageSquare, Music, Type
} from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ANIMATION_CATALOG, computeLayerState, stateToTransform, type LayerAnimation, type AnimationType } from "@/lib/animationEngine";
import AnimationPreview from "@/components/AnimationPreview";
import ExportDialog from "@/components/ExportDialog";
import SpeechBubbleLayer from "@/components/SpeechBubbleLayer";
import AudioPanel from "@/components/AudioPanel";
import TextLayer, { type TextLayerData } from "@/components/TextLayer";
import type { SpeechBubble } from "../../../drizzle/schema";

interface LocalLayer {
  id: number;
  panelId: number;
  name: string;
  imageUrl: string | null;
  x: number; y: number;
  width: number; height: number;
  zIndex: number;
  flipX: number;
  animations: LayerAnimation[];
}

interface LocalPanel {
  id: number;
  projectId: number;
  order: number;
  backgroundUrl: string | null;
  duration: number;
  transition: string;
  transitionDuration: number;
  panZoom: any;
  speechBubbles?: SpeechBubble[];
  audioUrl?: string | null;
  audioVolume?: number;
}

export default function Editor() {
  const params = useParams<{ projectId: string }>();
  const projectId = parseInt(params.projectId || "0");
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [panels, setPanels] = useState<LocalPanel[]>([]);
  const [layers, setLayers] = useState<LocalLayer[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showBubbles, setShowBubbles] = useState(true);
  const [textLayers, setTextLayers] = useState<TextLayerData[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, lx: 0, ly: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { uploadFile, uploading, progress } = useFileUpload();

  // Fetch project
  const { data: project } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: !!projectId && isAuthenticated }
  );

  // Fetch panels
  const { data: panelsData, refetch: refetchPanels } = trpc.panels.list.useQuery(
    { projectId },
    { enabled: !!projectId && isAuthenticated }
  );

  // Fetch layers for selected panel
  const { data: layersData, refetch: refetchLayers } = trpc.layers.list.useQuery(
    { panelId: selectedPanelId! },
    { enabled: !!selectedPanelId }
  );

  useEffect(() => {
    if (panelsData) {
      setPanels(panelsData as LocalPanel[]);
      if (panelsData.length > 0 && !selectedPanelId) {
        setSelectedPanelId(panelsData[0].id);
      }
    }
  }, [panelsData]);

  useEffect(() => {
    if (layersData) setLayers(layersData as LocalLayer[]);
  }, [layersData]);

  // Mutations
  const createPanel = trpc.panels.create.useMutation({
    onSuccess: () => refetchPanels(),
    onError: (e) => toast.error(e.message),
  });
  const updatePanel = trpc.panels.update.useMutation({
    onSuccess: () => refetchPanels(),
  });
  const updateProject = trpc.projects.update.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const deletePanel = trpc.panels.delete.useMutation({
    onSuccess: () => { refetchPanels(); setSelectedPanelId(null); },
  });
  const createLayer = trpc.layers.create.useMutation({
    onSuccess: () => refetchLayers(),
    onError: (e) => toast.error(e.message),
  });
  const updateLayer = trpc.layers.update.useMutation();
  const deleteLayer = trpc.layers.delete.useMutation({
    onSuccess: () => { refetchLayers(); setSelectedLayerId(null); },
  });

  // Canvas dimensions based on aspect ratio
  const canvasW = 360;
  const canvasH = project?.aspectRatio === "9:16" ? 640 : 270;

  // Play/pause animation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setPlayTime((t) => {
          const panel = panels.find(p => p.id === selectedPanelId);
          const dur = panel?.duration || 3;
          if (t >= dur) { setIsPlaying(false); return 0; }
          return t + 0.033;
        });
      }, 33);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, selectedPanelId, panels]);

  const selectedPanel = panels.find(p => p.id === selectedPanelId);
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // Upload background
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPanelId) return;
    try {
      const url = await uploadFile(file);
      await updatePanel.mutateAsync({ id: selectedPanelId, backgroundUrl: url });
      toast.success("Background uploaded");
    } catch (err: any) { toast.error(err.message); }
  };

  // Upload layer image
  const handleLayerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPanelId) return;
    try {
      const url = await uploadFile(file);
      await createLayer.mutateAsync({
        panelId: selectedPanelId,
        name: file.name.replace(/\.[^.]+$/, ""),
        imageUrl: url,
        x: 20, y: 10, width: 30, height: 50,
        zIndex: layers.length,
        animations: [],
      });
      toast.success("Layer added");
    } catch (err: any) { toast.error(err.message); }
  };

  // Save layer animations
  const saveLayerAnimations = async (layerId: number, anims: LayerAnimation[]) => {
    await updateLayer.mutateAsync({ id: layerId, animations: anims });
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, animations: anims } : l));
  };

  // Add animation to selected layer
  const addAnimation = async (type: AnimationType) => {
    if (!selectedLayer) return;
    const newAnim: LayerAnimation = { type, startTime: 0, duration: 2, repeat: true, intensity: 0.7 };
    const newAnims = [...(selectedLayer.animations || []), newAnim];
    await saveLayerAnimations(selectedLayer.id, newAnims);
  };

  const removeAnimation = async (idx: number) => {
    if (!selectedLayer) return;
    const newAnims = selectedLayer.animations.filter((_, i) => i !== idx);
    await saveLayerAnimations(selectedLayer.id, newAnims);
  };

  const updateAnimationField = async (idx: number, field: keyof LayerAnimation, value: any) => {
    if (!selectedLayer) return;
    const newAnims = selectedLayer.animations.map((a, i) => i === idx ? { ...a, [field]: value } : a);
    await saveLayerAnimations(selectedLayer.id, newAnims);
  };

  // Layer drag on canvas
  const handleLayerMouseDown = (e: React.MouseEvent, layerId: number) => {
    e.preventDefault();
    const layer = layers.find(l => l.id === layerId);
    if (!layer || !canvasRef.current) return;
    setSelectedLayerId(layerId);
    setIsDragging(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      lx: layer.x,
      ly: layer.y,
    });
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedLayerId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100;
    const newX = Math.max(0, Math.min(90, dragStart.lx + dx));
    const newY = Math.max(0, Math.min(90, dragStart.ly + dy));
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, x: newX, y: newY } : l));
  }, [isDragging, selectedLayerId, dragStart]);

  const handleCanvasMouseUp = useCallback(async () => {
    if (!isDragging || !selectedLayerId) return;
    setIsDragging(false);
    const layer = layers.find(l => l.id === selectedLayerId);
    if (layer) await updateLayer.mutateAsync({ id: selectedLayerId, x: layer.x, y: layer.y });
  }, [isDragging, selectedLayerId, layers]);

  // Add a text/caption layer
  const addTextLayer = () => {
    const newLayer: TextLayerData = {
      id: `text-${Date.now()}`,
      text: "Caption text",
      x: 50, y: 50,
      fontSize: 24,
      color: "#ffffff",
      bgColor: "transparent",
      bold: false, italic: false,
      align: "center",
      animation: "none",
      animationDuration: 1,
    };
    setTextLayers(prev => [...prev, newLayer]);
    setSelectedTextId(newLayer.id);
  };

  // Capture thumbnail from first panel background
  const captureThumbnail = useCallback(async (): Promise<string | null> => {
    const firstPanel = panels[0];
    if (!firstPanel?.backgroundUrl) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = project?.aspectRatio === "9:16" ? 568 : 240;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = firstPanel.backgroundUrl!; });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch { return null; }
  }, [panels, project?.aspectRatio]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Film className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm truncate">{project?.name || "Loading..."}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{project?.aspectRatio}</span>
        </div>
        <Button
          size="sm" variant="outline"
          onClick={async () => {
            if (!project) return;
            const newVal = project.isPublic ? 0 : 1;
            // Capture thumbnail when publishing
            let thumbnailUrl: string | null | undefined = undefined;
            if (newVal === 1) {
              thumbnailUrl = await captureThumbnail();
            }
            updateProject.mutate({ id: project.id, isPublic: newVal, ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}) });
            toast.success(newVal ? "Published to gallery!" : "Removed from gallery");
          }}
          className="gap-2"
          title={project?.isPublic ? "Remove from Gallery" : "Publish to Gallery"}
        >
          <Globe className="w-4 h-4" />
          {project?.isPublic ? "Published" : "Publish"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowExport(true)} className="gap-2">
          <Download className="w-4 h-4" />
          Export Reel
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Panel timeline */}
        <div className="w-48 border-r border-border flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Panels</span>
            <Button
              size="icon"
              variant="ghost"
              className="w-6 h-6"
              onClick={() => createPanel.mutate({ projectId, order: panels.length })}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {panels.map((panel, idx) => (
              <div
                key={panel.id}
                className={`relative rounded-lg overflow-hidden border cursor-pointer transition-colors ${
                  selectedPanelId === panel.id ? "border-primary" : "border-border hover:border-border/80"
                }`}
                onClick={() => { setSelectedPanelId(panel.id); setSelectedLayerId(null); setPlayTime(0); }}
              >
                <div
                  className="bg-muted flex items-center justify-center"
                  style={{ aspectRatio: project?.aspectRatio === "9:16" ? "9/16" : "4/3" }}
                >
                  {panel.backgroundUrl ? (
                    <img src={panel.backgroundUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Panel {idx + 1}</span>
                  )}
                </div>
                <div className="absolute top-1 right-1 flex gap-1">
                  <button
                    className="w-5 h-5 bg-destructive/80 rounded text-white flex items-center justify-center hover:bg-destructive"
                    onClick={(e) => { e.stopPropagation(); deletePanel.mutate({ id: panel.id }); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-xs px-1 py-0.5 text-center">
                  {panel.duration}s
                </div>
              </div>
            ))}
            {panels.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">
                Click + to add a panel
              </div>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 overflow-hidden">
          {selectedPanel ? (
            <div className="flex flex-col items-center gap-4">
              {/* Canvas */}
              <div
                ref={canvasRef}
                className="relative bg-black rounded-lg overflow-hidden shadow-2xl select-none"
                style={{ width: canvasW, height: canvasH }}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                {/* Background */}
                {selectedPanel.backgroundUrl ? (
                  <img
                    src={selectedPanel.backgroundUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    alt="background"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    No background — upload one in the panel settings
                  </div>
                )}

                {/* Speech Bubbles overlay */}
                {showBubbles && selectedPanel && (
                  <SpeechBubbleLayer
                    bubbles={selectedPanel.speechBubbles || []}
                    canvasWidth={canvasW}
                    canvasHeight={canvasH}
                    onChange={async (bubbles) => {
                      setPanels(prev => prev.map(p => p.id === selectedPanel.id ? { ...p, speechBubbles: bubbles } : p));
                      await updatePanel.mutateAsync({ id: selectedPanel.id, speechBubbles: bubbles });
                    }}
                  />
                )}

                {/* Layers */}
                {layers.map((layer) => {
                  const state = computeLayerState(playTime, layer.animations || [], canvasW);
                  const isSelected = layer.id === selectedLayerId;
                  return (
                    <div
                      key={layer.id}
                      className={`absolute cursor-grab ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        width: `${layer.width}%`,
                        height: `${layer.height}%`,
                        zIndex: layer.zIndex + 1,
                        transform: stateToTransform(state),
                        opacity: state.opacity,
                        transformOrigin: "center bottom",
                      }}
                      onMouseDown={(e) => handleLayerMouseDown(e, layer.id)}
                    >
                      {layer.imageUrl && (
                        <img
                          src={layer.imageUrl}
                          className="w-full h-full object-contain pointer-events-none"
                          style={{ transform: layer.flipX ? "scaleX(-1)" : "none" }}
                          draggable={false}
                          alt={layer.name}
                        />
                      )}
                    </div>
                  );
                })}
              {/* Text/Caption Layers */}
                {textLayers.map((tl) => (
                  <TextLayer
                    key={tl.id}
                    layer={tl}
                    canvasWidth={canvasW}
                    canvasHeight={canvasH}
                    selected={selectedTextId === tl.id}
                    onSelect={() => setSelectedTextId(tl.id)}
                    onChange={(updated) => setTextLayers(prev => prev.map(l => l.id === tl.id ? updated : l))}
                    onDelete={() => { setTextLayers(prev => prev.filter(l => l.id !== tl.id)); setSelectedTextId(null); }}
                  />
                ))}
              </div>

              {/* Playback controls */}
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setIsPlaying(!isPlaying); if (!isPlaying) setPlayTime(0); }}
                  className="gap-2"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? "Pause" : "Preview"}
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{playTime.toFixed(1)}s</span>
                  <span>/</span>
                  <span>{selectedPanel.duration}s</span>
                </div>
                <Button size="sm" variant="ghost"
                  onClick={() => setShowBubbles(v => !v)}
                  className="gap-1 text-xs"
                  title="Toggle speech bubbles visibility">
                  <MessageSquare className="w-3 h-3" />
                  {showBubbles ? "Hide Bubbles" : "Show Bubbles"}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={addTextLayer}
                  className="gap-1 text-xs"
                  title="Add text/caption overlay">
                  <Type className="w-3 h-3" />
                  Add Text
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select or create a panel to start editing</p>
            </div>
          )}
        </div>

        {/* Right: Properties panel */}
        <div className="w-72 border-l border-border flex flex-col shrink-0 overflow-hidden">
          <Tabs defaultValue="panel" className="flex flex-col h-full">
            <TabsList className="w-full rounded-none border-b border-border shrink-0">
              <TabsTrigger value="panel" className="flex-1 text-xs gap-1">
                <Settings className="w-3 h-3" />Panel
              </TabsTrigger>
              <TabsTrigger value="layers" className="flex-1 text-xs gap-1">
                <Layers className="w-3 h-3" />Layers
              </TabsTrigger>
              <TabsTrigger value="animate" className="flex-1 text-xs gap-1">
                <Play className="w-3 h-3" />Animate
              </TabsTrigger>
            </TabsList>

            {/* Panel settings */}
            <TabsContent value="panel" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
              {selectedPanel ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Background Image</Label>
                    <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors text-sm text-muted-foreground">
                      <Upload className="w-4 h-4" />
                      {uploading ? `Uploading ${progress}%` : "Upload Background"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Duration: {selectedPanel.duration}s</Label>
                    <Slider
                      min={1} max={10} step={0.5}
                      value={[selectedPanel.duration]}
                      onValueChange={([v]) => updatePanel.mutate({ id: selectedPanel.id, duration: v })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Transition</Label>
                    <Select
                      value={selectedPanel.transition}
                      onValueChange={(v) => updatePanel.mutate({ id: selectedPanel.id, transition: v as any })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["none", "fade", "slide-left", "slide-right", "zoom-in", "zoom-out"].map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Panel Audio */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1"><Music className="w-3 h-3" /> Panel Audio</Label>
                    <AudioPanel
                      label="Panel Audio"
                      audioUrl={selectedPanel.audioUrl}
                      volume={selectedPanel.audioVolume ?? 1}
                      onAudioChange={(url, vol) => {
                        setPanels(prev => prev.map(p => p.id === selectedPanel.id ? { ...p, audioUrl: url, audioVolume: vol } : p));
                        updatePanel.mutate({ id: selectedPanel.id, audioUrl: url, audioVolume: vol });
                      }}
                    />
                  </div>

                  {/* Project Background Music */}
                  {project && (
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Music className="w-3 h-3" /> Background Music</Label>
                      <AudioPanel
                        label="Project BG Music"
                        audioUrl={(project as any).bgMusicUrl}
                        volume={(project as any).bgMusicVolume ?? 0.8}
                        onAudioChange={(url, vol) => {
                          updateProject.mutate({ id: project.id, bgMusicUrl: url, bgMusicVolume: vol });
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Select a panel first</p>
              )}
            </TabsContent>

            {/* Layers */}
            <TabsContent value="layers" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
              {selectedPanel ? (
                <>
                  <label className="flex items-center justify-center gap-2 border border-dashed border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors text-xs text-muted-foreground">
                    <Upload className="w-3 h-3" />
                    {uploading ? `Uploading ${progress}%` : "Add Character Layer (PNG)"}
                    <input type="file" accept="image/png,image/*" className="hidden" onChange={handleLayerUpload} />
                  </label>

                  <div className="space-y-2">
                    {layers.map((layer) => (
                      <div
                        key={layer.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedLayerId === layer.id ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
                        }`}
                        onClick={() => setSelectedLayerId(layer.id)}
                      >
                        {layer.imageUrl ? (
                          <img src={layer.imageUrl} className="w-8 h-8 object-contain rounded" alt="" />
                        ) : (
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                            <Layers className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="flex-1 text-xs truncate">{layer.name}</span>
                        <div className="flex gap-1">
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); updateLayer.mutate({ id: layer.id, flipX: layer.flipX ? 0 : 1 }); refetchLayers(); }}
                          >
                            <FlipHorizontal className="w-3 h-3" />
                          </button>
                          <button
                            className="text-destructive hover:text-destructive/80"
                            onClick={(e) => { e.stopPropagation(); deleteLayer.mutate({ id: layer.id }); }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected layer size controls */}
                  {selectedLayer && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground">Layer Size</p>
                      <div className="space-y-1">
                        <Label className="text-xs">Width: {selectedLayer.width.toFixed(0)}%</Label>
                        <Slider
                          min={5} max={100} step={1}
                          value={[selectedLayer.width]}
                          onValueChange={([v]) => { setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, width: v } : l)); updateLayer.mutate({ id: selectedLayer.id, width: v }); }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Height: {selectedLayer.height.toFixed(0)}%</Label>
                        <Slider
                          min={5} max={100} step={1}
                          value={[selectedLayer.height]}
                          onValueChange={([v]) => { setLayers(prev => prev.map(l => l.id === selectedLayer.id ? { ...l, height: v } : l)); updateLayer.mutate({ id: selectedLayer.id, height: v }); }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Select a panel first</p>
              )}
            </TabsContent>

            {/* Animations */}
            <TabsContent value="animate" className="flex-1 overflow-y-auto mt-0">
              {selectedLayer ? (
                <div className="p-4 space-y-4">
                  <p className="text-xs font-semibold">Animations for: <span className="text-primary">{selectedLayer.name}</span></p>

                  {/* Current animations */}
                  {selectedLayer.animations?.map((anim, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{ANIMATION_CATALOG.find(a => a.type === anim.type)?.label || anim.type}</span>
                        <button onClick={() => removeAnimation(idx)} className="text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Start: {anim.startTime}s</Label>
                        <Slider min={0} max={10} step={0.1} value={[anim.startTime]}
                          onValueChange={([v]) => updateAnimationField(idx, "startTime", v)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Duration: {anim.duration}s</Label>
                        <Slider min={0.1} max={10} step={0.1} value={[anim.duration]}
                          onValueChange={([v]) => updateAnimationField(idx, "duration", v)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Intensity: {(anim.intensity * 100).toFixed(0)}%</Label>
                        <Slider min={0.1} max={1} step={0.05} value={[anim.intensity]}
                          onValueChange={([v]) => updateAnimationField(idx, "intensity", v)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`repeat-${idx}`}
                          checked={anim.repeat}
                          onChange={(e) => updateAnimationField(idx, "repeat", e.target.checked)}
                          className="cursor-pointer"
                        />
                        <Label htmlFor={`repeat-${idx}`} className="text-xs cursor-pointer">Repeat</Label>
                      </div>
                    </div>
                  ))}

                  {/* Add animation */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Add Animation</p>
                    {Object.entries(
                      ANIMATION_CATALOG.reduce((acc, a) => {
                        if (!acc[a.category]) acc[a.category] = [];
                        acc[a.category].push(a);
                        return acc;
                      }, {} as Record<string, typeof ANIMATION_CATALOG>)
                    ).map(([category, anims]) => (
                      <div key={category}>
                        <p className="text-xs text-muted-foreground mb-1">{category}</p>
                        <div className="flex flex-wrap gap-1">
                          {anims.map((a) => (
                            <button
                              key={a.type}
                              onClick={() => addAnimation(a.type)}
                              className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded transition-colors"
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs text-muted-foreground text-center py-8">
                  Select a layer to add animations
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Export dialog */}
      {showExport && project && (
        <ExportDialog
          project={project}
          panels={panels}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
