import { useState, useRef, useEffect } from "react";

export interface TextLayerData {
  id: string;
  text: string;
  x: number; // percent of canvas width
  y: number; // percent of canvas height
  fontSize: number; // px
  color: string;
  bgColor: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  animation: "none" | "fadeIn" | "slideUp" | "slideLeft" | "typewriter";
  animationDuration: number; // seconds
}

interface Props {
  layer: TextLayerData;
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (updated: TextLayerData) => void;
  onDelete: () => void;
}

export default function TextLayer({ layer, canvasWidth, canvasHeight, selected, onSelect, onChange, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; lx: number; ly: number } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      textRef.current.select();
    }
  }, [editing]);

  const px = (layer.x / 100) * canvasWidth;
  const py = (layer.y / 100) * canvasHeight;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editing) return;
    e.stopPropagation();
    onSelect();
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, lx: layer.x, ly: layer.y };
    const onMove = (me: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = ((me.clientX - dragStart.current.mx) / canvasWidth) * 100;
      const dy = ((me.clientY - dragStart.current.my) / canvasHeight) * 100;
      onChange({
        ...layer,
        x: Math.max(0, Math.min(100, dragStart.current.lx + dx)),
        y: Math.max(0, Math.min(100, dragStart.current.ly + dy)),
      });
    };
    const onUp = () => {
      setDragging(false);
      dragStart.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const animClass = (() => {
    switch (layer.animation) {
      case "fadeIn": return "animate-[fadeIn_var(--dur)_ease_forwards]";
      case "slideUp": return "animate-[slideUp_var(--dur)_ease_forwards]";
      case "slideLeft": return "animate-[slideLeft_var(--dur)_ease_forwards]";
      default: return "";
    }
  })();

  return (
    <div
      className={`absolute select-none ${dragging ? "cursor-grabbing" : "cursor-grab"} ${selected ? "ring-2 ring-primary ring-offset-1" : ""}`}
      style={{ left: px, top: py, transform: "translate(-50%, -50%)" }}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
    >
      {editing ? (
        <textarea
          ref={textRef}
          className="bg-transparent border border-primary outline-none resize-none text-center min-w-[80px]"
          style={{
            fontSize: layer.fontSize,
            color: layer.color,
            fontWeight: layer.bold ? "bold" : "normal",
            fontStyle: layer.italic ? "italic" : "normal",
            textAlign: layer.align,
            background: layer.bgColor === "transparent" ? "transparent" : layer.bgColor,
          }}
          value={layer.text}
          onChange={(e) => onChange({ ...layer, text: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
          rows={3}
        />
      ) : (
        <div
          className={animClass}
          style={{
            fontSize: layer.fontSize,
            color: layer.color,
            fontWeight: layer.bold ? "bold" : "normal",
            fontStyle: layer.italic ? "italic" : "normal",
            textAlign: layer.align,
            background: layer.bgColor === "transparent" ? "transparent" : layer.bgColor,
            padding: layer.bgColor !== "transparent" ? "4px 8px" : undefined,
            borderRadius: layer.bgColor !== "transparent" ? 4 : undefined,
            whiteSpace: "pre-wrap",
            maxWidth: canvasWidth * 0.8,
            "--dur": `${layer.animationDuration}s`,
          } as React.CSSProperties}
        >
          {layer.text || "Double-click to edit"}
        </div>
      )}
      {selected && !editing && (
        <button
          className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center hover:bg-destructive/80"
          onMouseDown={(e) => { e.stopPropagation(); onDelete(); }}
        >×</button>
      )}
    </div>
  );
}
