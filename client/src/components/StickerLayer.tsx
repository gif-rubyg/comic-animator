import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Smile } from "lucide-react";

export interface StickerData {
  id: string;
  emoji: string;
  x: number; // percent
  y: number; // percent
  size: number; // percent of canvas width
  animation: "none" | "bounce" | "spin" | "pulse" | "shake" | "float";
}

const STICKER_CATEGORIES = {
  "Expressions 😄": ["😀","😂","😍","😎","😭","😡","🤔","😱","🥳","😴","🤩","😏","🥺","😤","🤣","😬","🤯","😇","🥰","😈"],
  "Actions 👋": ["👋","🤝","👏","🙌","👍","👎","✌️","🤞","🤜","🤛","💪","🦾","🖐️","👆","👇","👈","👉","🤙","🫶","🫂"],
  "Hearts ❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💞","💓","💗","💖","💘","💝","💟","❣️","💌","🫀"],
  "Effects ✨": ["✨","⭐","🌟","💫","🔥","💥","💢","💨","💦","🌊","❄️","🌈","☁️","⚡","🎆","🎇","🎉","🎊","🎈","🎀"],
  "Comic 💬": ["💬","💭","🗯️","💤","‼️","⁉️","❓","❗","🔔","📢","📣","🚨","⚠️","🔴","🟡","🟢","🔵","⚫","⚪","🟣"],
  "Animals 🐱": ["🐱","🐶","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🦆","🦅"],
  "Food 🍕": ["🍕","🍔","🌮","🌯","🍜","🍣","🍦","🍩","🍪","🎂","🍰","🧁","🍫","🍬","🍭","🥤","☕","🧃","🍺","🥂"],
  "Sports ⚽": ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🥋","🏆","🥇","🎯","🎮","🎲","🎭","🎨","🎬"],
};

interface Props {
  stickers: StickerData[];
  onChange: (stickers: StickerData[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  readonly?: boolean;
}

function generateId() { return Math.random().toString(36).slice(2); }

export default function StickerLayer({ stickers, onChange, canvasWidth, canvasHeight, readonly }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Expressions 😄");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const addSticker = useCallback((emoji: string) => {
    const newSticker: StickerData = {
      id: generateId(),
      emoji,
      x: 40 + Math.random() * 20,
      y: 40 + Math.random() * 20,
      size: 8,
      animation: "none",
    };
    onChange([...stickers, newSticker]);
    setSelectedId(newSticker.id);
    setShowPicker(false);
  }, [stickers, onChange]);

  const updateSticker = useCallback((id: string, updates: Partial<StickerData>) => {
    onChange(stickers.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [stickers, onChange]);

  const deleteSticker = useCallback((id: string) => {
    onChange(stickers.filter(s => s.id !== id));
    setSelectedId(null);
  }, [stickers, onChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (readonly) return;
    e.stopPropagation();
    setSelectedId(id);
    const sticker = stickers.find(s => s.id === id);
    if (!sticker) return;
    dragging.current = { id, startX: e.clientX, startY: e.clientY, origX: sticker.x, origY: sticker.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((ev.clientX - dragging.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - dragging.current.startY) / rect.height) * 100;
      updateSticker(dragging.current.id, {
        x: Math.max(0, Math.min(95, dragging.current.origX + dx)),
        y: Math.max(0, Math.min(95, dragging.current.origY + dy)),
      });
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [stickers, updateSticker, readonly]);

  const getAnimClass = (anim: string) => {
    switch (anim) {
      case "bounce": return "animate-bounce";
      case "spin": return "animate-spin";
      case "pulse": return "animate-pulse";
      case "shake": return "animate-[wiggle_0.5s_ease-in-out_infinite]";
      case "float": return "animate-[float_2s_ease-in-out_infinite]";
      default: return "";
    }
  };

  const selectedSticker = stickers.find(s => s.id === selectedId);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
      {/* Sticker Add Button */}
      {!readonly && (
        <div className="absolute top-2 right-2 pointer-events-auto" style={{ zIndex: 30 }}>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs gap-1 opacity-80 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); setShowPicker(v => !v); }}
          >
            <Smile className="w-3 h-3" />
            Sticker
          </Button>

          {/* Sticker Picker */}
          {showPicker && (
            <div
              className="absolute right-0 top-8 bg-popover border border-border rounded-xl shadow-xl w-72 z-50 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Category tabs */}
              <div className="flex overflow-x-auto border-b border-border bg-muted/50 p-1 gap-1">
                {Object.keys(STICKER_CATEGORIES).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-2 py-1 rounded-md whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    {cat.split(" ")[1]}
                  </button>
                ))}
              </div>
              {/* Emoji grid */}
              <div className="p-2 grid grid-cols-10 gap-1 max-h-40 overflow-y-auto">
                {STICKER_CATEGORIES[activeCategory as keyof typeof STICKER_CATEGORIES].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => addSticker(emoji)}
                    className="text-lg hover:bg-accent rounded p-0.5 transition-colors"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render stickers */}
      {stickers.map(sticker => {
        const isSelected = selectedId === sticker.id;
        const fontSize = (sticker.size / 100) * canvasWidth;
        return (
          <div
            key={sticker.id}
            className={`absolute pointer-events-auto select-none cursor-move ${getAnimClass(sticker.animation)}`}
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              fontSize: `${Math.max(16, Math.min(fontSize, 120))}px`,
              lineHeight: 1,
              outline: isSelected && !readonly ? "2px dashed hsl(var(--primary))" : "none",
              borderRadius: "4px",
              padding: "2px",
              userSelect: "none",
            }}
            onMouseDown={(e) => handleMouseDown(e, sticker.id)}
            onClick={(e) => { e.stopPropagation(); if (!readonly) setSelectedId(sticker.id); }}
          >
            {sticker.emoji}
            {isSelected && !readonly && (
              <button
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
                onClick={(e) => { e.stopPropagation(); deleteSticker(sticker.id); }}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Sticker controls */}
      {selectedSticker && !readonly && (
        <div
          className="absolute bottom-2 left-2 bg-popover/95 border border-border rounded-lg p-2 flex items-center gap-2 text-xs pointer-events-auto shadow-lg"
          onClick={e => e.stopPropagation()}
          style={{ zIndex: 30 }}
        >
          <span className="text-muted-foreground">Size:</span>
          <input
            type="range" min="4" max="20" step="1"
            value={selectedSticker.size}
            onChange={e => updateSticker(selectedSticker.id, { size: Number(e.target.value) })}
            className="w-20 h-1 accent-primary"
          />
          <span className="text-muted-foreground">Anim:</span>
          <select
            value={selectedSticker.animation}
            onChange={e => updateSticker(selectedSticker.id, { animation: e.target.value as StickerData["animation"] })}
            className="bg-background border border-border rounded px-1 py-0.5 text-xs"
          >
            {["none","bounce","spin","pulse","shake","float"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={() => deleteSticker(selectedSticker.id)}
            className="text-destructive hover:text-destructive/80 ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
