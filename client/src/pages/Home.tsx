import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Film, Sparkles, Zap } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated]);

  if (!loading && isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-7 h-7 text-primary" />
          <span className="text-xl font-bold text-foreground">Comic Animator</span>
        </div>
        <Button onClick={() => navigate("/login")}>
          Sign In
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 py-20">
        <div className="space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Turn Comics into Reels
          </div>
          <h1 className="text-5xl font-extrabold text-foreground leading-tight">
            Animate Your Comics<br />
            <span className="text-primary">Into Social Reels</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload comic panels, add character animations — blink, wave, laugh, walk, and more —
            then export as 9:16 or 4:3 video reels for Instagram, TikTok, and YouTube Shorts.
          </p>
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Button size="lg" onClick={() => navigate("/login")} className="gap-2">
            <Zap className="w-5 h-5" />
            Get Started
          </Button>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full mt-8">
          {[
            { icon: "🎭", title: "20+ Animations", desc: "Blink, wink, wave, laugh, walk, run, crawl, fat/thin, hair fly, and more" },
            { icon: "🎬", title: "Reel Export", desc: "Export as 9:16 vertical or 4:3 landscape MP4 for any social platform" },
            { icon: "🖼️", title: "Layer Editor", desc: "Upload character PNGs as separate layers and position them freely" },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-6 text-left space-y-2">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-muted-foreground text-sm">
        animate.crowncrew.dev — Comic Animator
      </footer>
    </div>
  );
}
