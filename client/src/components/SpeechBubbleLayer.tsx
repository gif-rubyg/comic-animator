import React, { useState, useRef, useCallback } from "react";
import type { SpeechBubble } from "../../../drizzle/schema";

interface Props {
  bubbles: SpeechBubble[];
  onChange: (bubbles: SpeechBubble[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  readonly?: boolean;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function BubbleTailPath(style: SpeechBubble["style"], tail: SpeechBubble["tailDirection"], w: number, h: number) {
  if (style === "thought" || tail === "none") return null;
  const cx = w / 2, cy = h / 2;
  const tailSize = Math.min(w, h) * 0.18;
  switch (tail) {
    case "left":  return `M ${-tailSize} ${cy} L 12 ${cy - 8} L 12 ${cy + 8} Z`;
    case "right": return `M ${w + tailSize} ${cy} L ${w - 12} ${cy - 8} L ${w - 12} ${cy + 8} Z`;
    case "up":    return `M ${cx} ${-tailSize} L ${cx - 8} 12 L ${cx + 8} 12 Z`;
    case "down":  return `M ${cx} ${h + tailSize} L ${cx - 8} ${h - 12} L ${cx + 8} ${h - 12} Z`;
    default: return null;
  }
}

function BubbleShape({ bubble, w, h, editing, onDoubleClick }: {
  bubble: SpeechBubble; w: number; h: number;
  editing: boolean; onDoubleClick: () => void;
}) {
  const tailPath = BubbleTailPath(bubble.style, bubble.tailDirection, w, h);
  const r = bubble.style === "shout" ? 4 : 12;

  return (
    <svg
      width={w + 40} height={h + 40}
      style={{ position: "absolute", left: -20, top: -20, overflow: "visible", pointerEvents: "none" }}
    >
      {/* tail */}
      {tailPath && (
        <path d={tailPath} transform="translate(20,20)"
          fill={bubble.bgColor} stroke={bubble.borderColor} strokeWidth={2} strokeLinejoin="round" />
      )}
      {/* body */}
      {bubble.style === "thought" ? (
        <ellipse cx={w / 2 + 20} cy={h / 2 + 20} rx={w / 2} ry={h / 2}
          fill={bubble.bgColor} stroke={bubble.borderColor} strokeWidth={2} />
      ) : bubble.style === "shout" ? (
        <polygon
          points={`20,${h * 0.3 + 20} ${w * 0.1 + 20},20 ${w * 0.4 + 20},20 ${w * 0.5 + 20},${20} ${w * 0.6 + 20},20 ${w * 0.9 + 20},20 ${w + 20},${h * 0.3 + 20} ${w + 20},${h * 0.7 + 20} ${w * 0.9 + 20},${h + 20} ${w * 0.1 + 20},${h + 20} 20,${h * 0.7 + 20}`}
          fill={bubble.bgColor} stroke={bubble.borderColor} strokeWidth={2} strokeLinejoin="round"
        />
      ) : (
        <rect x={20} y={20} width={w} height={h} rx={r} ry={r}
          fill={bubble.bgColor} stroke={bubble.borderColor} strokeWidth={2} />
      )}
    </svg>
  );
}

export default function SpeechBubbleLayer({ bubbles, onChange, canvasWidth, canvasHeight, readonly }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const addBubble = useCallback(() => {
    const newBubble: SpeechBubble = {
      id: generateId(),
      text: "Say something...",
      style: "speech",
      tailDirection: "down",
      x: 10,
      y: 10,
      width: 40,
      fontSize: 14,
      fontColor: "#111111",
      bgColor: "#ffffff",
      borderColor: "#222222",
    };
    onChange([...bubbles, newBubble]);
    setSelected(newBubble.id);
  }, [bubbles, onChange]);

  const updateBubble = useCallback((id: string, patch: Partial<SpeechBubble>) => {
    onChange(bubbles.map(b => b.id === id ? { ...b, ...patch } : b));
  }, [bubbles, onChange]);

  const deleteBubble = useCallback((id: string) => {
    onChange(bubbles.filter(b => b.id !== id));
    setSelected(null);
    setEditing(null);
  }, [bubbles, onChange]);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (readonly) return;
    e.stopPropagation();
    setSelected(id);
    const bubble = bubbles.find(b => b.id === id)!;
    setDragging({ id, startX: e.clientX, startY: e.clientY, origX: bubble.x, origY: bubble.y });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = ((e.clientX - dragging.startX) / canvasWidth) * 100;
    const dy = ((e.clientY - dragging.startY) / canvasHeight) * 100;
    updateBubble(dragging.id, { x: Math.max(0, dragging.origX + dx), y: Math.max(0, dragging.origY + dy) });
  }, [dragging, canvasWidth, canvasHeight, updateBubble]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const sel = selected ? bubbles.find(b => b.id === selected) : null;

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, pointerEvents: readonly ? "none" : "auto" }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => { setSelected(null); setEditing(null); }}
    >
      {bubbles.map(bubble => {
        const bw = (bubble.width / 100) * canvasWidth;
        const bh = Math.max(40, bw * 0.45);
        const bx = (bubble.x / 100) * canvasWidth;
        const by = (bubble.y / 100) * canvasHeight;
        const isSelected = selected === bubble.id;
        const isEditing = editing === bubble.id;

        return (
          <div
            key={bubble.id}
            style={{
              position: "absolute",
              left: bx,
              top: by,
              width: bw,
              height: bh,
              cursor: readonly ? "default" : "move",
              userSelect: "none",
              outline: isSelected && !readonly ? "2px dashed #3b82f6" : "none",
              outlineOffset: 2,
              zIndex: 100,
            }}
            onMouseDown={e => handleMouseDown(e, bubble.id)}
            onDoubleClick={e => { e.stopPropagation(); if (!readonly) setEditing(bubble.id); }}
            onClick={e => e.stopPropagation()}
          >
            <BubbleShape bubble={bubble} w={bw} h={bh} editing={isEditing} onDoubleClick={() => setEditing(bubble.id)} />
            <div style={{
              position: "absolute", inset: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1,
            }}>
              {isEditing ? (
                <textarea
                  autoFocus
                  value={bubble.text}
                  onChange={e => updateBubble(bubble.id, { text: e.target.value })}
                  onBlur={() => setEditing(null)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: "100%", height: "100%", border: "none", background: "transparent",
                    resize: "none", textAlign: "center", fontSize: bubble.fontSize,
                    color: bubble.fontColor, fontFamily: "inherit", outline: "none",
                  }}
                />
              ) : (
                <span style={{
                  fontSize: bubble.fontSize, color: bubble.fontColor,
                  textAlign: "center", wordBreak: "break-word", lineHeight: 1.3,
                  fontWeight: bubble.style === "shout" ? 700 : 400,
                }}>
                  {bubble.text}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Controls panel for selected bubble */}
      {sel && !readonly && (
        <div
          style={{
            position: "absolute", bottom: 8, left: 8, right: 8,
            background: "rgba(15,15,20,0.92)", borderRadius: 8, padding: "8px 12px",
            display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", zIndex: 200,
          }}
          onClick={e => e.stopPropagation()}
        >
          <span style={{ color: "#aaa", fontSize: 11, fontWeight: 600 }}>Bubble:</span>

          {/* Style */}
          <select value={sel.style} onChange={e => updateBubble(sel.id, { style: e.target.value as any })}
            style={{ fontSize: 11, background: "#1e1e2e", color: "#fff", border: "1px solid #444", borderRadius: 4, padding: "2px 4px" }}>
            <option value="speech">Speech</option>
            <option value="thought">Thought</option>
            <option value="shout">Shout</option>
            <option value="whisper">Whisper</option>
          </select>

          {/* Tail */}
          <select value={sel.tailDirection} onChange={e => updateBubble(sel.id, { tailDirection: e.target.value as any })}
            style={{ fontSize: 11, background: "#1e1e2e", color: "#fff", border: "1px solid #444", borderRadius: 4, padding: "2px 4px" }}>
            <option value="down">Tail ↓</option>
            <option value="up">Tail ↑</option>
            <option value="left">Tail ←</option>
            <option value="right">Tail →</option>
            <option value="none">No Tail</option>
          </select>

          {/* Font size */}
          <label style={{ color: "#aaa", fontSize: 11 }}>Size:
            <input type="range" min={8} max={32} value={sel.fontSize}
              onChange={e => updateBubble(sel.id, { fontSize: +e.target.value })}
              style={{ width: 60, marginLeft: 4 }} />
          </label>

          {/* Width */}
          <label style={{ color: "#aaa", fontSize: 11 }}>Width:
            <input type="range" min={10} max={80} value={sel.width}
              onChange={e => updateBubble(sel.id, { width: +e.target.value })}
              style={{ width: 60, marginLeft: 4 }} />
          </label>

          {/* Font color */}
          <label style={{ color: "#aaa", fontSize: 11 }}>Text:
            <input type="color" value={sel.fontColor}
              onChange={e => updateBubble(sel.id, { fontColor: e.target.value })}
              style={{ width: 28, height: 20, marginLeft: 4, border: "none", cursor: "pointer" }} />
          </label>

          {/* BG color */}
          <label style={{ color: "#aaa", fontSize: 11 }}>Fill:
            <input type="color" value={sel.bgColor}
              onChange={e => updateBubble(sel.id, { bgColor: e.target.value })}
              style={{ width: 28, height: 20, marginLeft: 4, border: "none", cursor: "pointer" }} />
          </label>

          {/* Border color */}
          <label style={{ color: "#aaa", fontSize: 11 }}>Border:
            <input type="color" value={sel.borderColor}
              onChange={e => updateBubble(sel.id, { borderColor: e.target.value })}
              style={{ width: 28, height: 20, marginLeft: 4, border: "none", cursor: "pointer" }} />
          </label>

          {/* Delete */}
          <button onClick={() => deleteBubble(sel.id)}
            style={{ marginLeft: "auto", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>
            Delete
          </button>
        </div>
      )}

      {/* Add bubble button */}
      {!readonly && (
        <button
          onClick={e => { e.stopPropagation(); addBubble(); }}
          style={{
            position: "absolute", top: 8, right: 8,
            background: "#3b82f6", color: "#fff", border: "none", borderRadius: 6,
            padding: "4px 10px", fontSize: 12, cursor: "pointer", zIndex: 200,
          }}
        >
          + Bubble
        </button>
      )}
    </div>
  );
}
