import React, { useRef, useState } from "react";
import { Music, Upload, Trash2, Volume2, Play, Pause } from "lucide-react";
import { toast } from "sonner";

interface Props {
  label?: string;
  audioUrl: string | null | undefined;
  volume: number;
  onAudioChange: (url: string | null, volume: number) => void;
  accept?: string;
}

export default function AudioPanel({ label = "Panel Audio", audioUrl, volume, onAudioChange, accept = "audio/*" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const handleUpload = async (file: File) => {
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Audio file must be under 16 MB");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onAudioChange(data.url, volume);
      toast.success("Audio uploaded!");
    } catch (e) {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/60">
        <Music size={13} />
        {label}
      </div>

      {audioUrl ? (
        <div className="space-y-2">
          {/* Playback */}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay}
              className="w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center transition-colors">
              {playing ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <span className="text-xs text-white/50 truncate flex-1">
              {audioUrl.split("/").pop()}
            </span>
            <button onClick={() => { onAudioChange(null, volume); setPlaying(false); }}
              className="text-red-400 hover:text-red-300 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Volume2 size={12} className="text-white/40" />
            <input type="range" min={0} max={1} step={0.05} value={volume}
              onChange={e => onAudioChange(audioUrl, +e.target.value)}
              className="flex-1 h-1 accent-purple-500" />
            <span className="text-xs text-white/40 w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>

          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-white/20 rounded-md py-2 text-xs text-white/40 hover:text-white/70 hover:border-white/40 transition-colors"
        >
          {uploading ? (
            <span className="animate-pulse">Uploading...</span>
          ) : (
            <>
              <Upload size={13} />
              Upload audio (MP3, WAV, OGG, M4A)
            </>
          )}
        </button>
      )}

      <input ref={fileRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
    </div>
  );
}
