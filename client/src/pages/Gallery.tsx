import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Heart, Film, User, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Gallery() {
  const { isAuthenticated } = useAuth();
  const { data: projects, isLoading, refetch } = trpc.gallery.list.useQuery();
  const likeMutation = trpc.gallery.like.useMutation({
    onSuccess: () => { refetch(); },
    onError: () => toast.error("Could not like project"),
  });

  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 ml-auto">
          <Film size={20} className="text-purple-400" />
          <span className="font-bold text-lg">Public Gallery</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Community Reels</h1>
          <p className="text-white/50">Browse animated comic reels shared by the community.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-purple-400" size={32} />
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Film size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No public projects yet.</p>
            <p className="text-sm mt-1">Be the first to publish your comic reel!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {projects.map(project => (
              <div key={project.id}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group">
                {/* Thumbnail placeholder */}
                <div className={`relative flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-indigo-900/40 ${project.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-[4/3]"}`}>
                  <Film size={40} className="text-white/20" />
                  <div className="absolute top-2 right-2 bg-black/60 text-white/70 text-xs px-2 py-0.5 rounded-full">
                    {project.aspectRatio}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-white truncate">{project.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-white/40 text-xs">
                    <User size={12} />
                    <span>{project.userName || "Anonymous"}</span>
                    <span className="ml-auto">
                      {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Like button */}
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (!isAuthenticated) { toast.error("Login to like projects"); return; }
                        likeMutation.mutate({ id: project.id });
                      }}
                      className="flex items-center gap-1.5 text-sm text-white/50 hover:text-pink-400 transition-colors"
                    >
                      <Heart size={15} className={likeMutation.isPending ? "animate-pulse" : ""} />
                      <span>{project.likesCount ?? 0}</span>
                    </button>
                    {isAuthenticated && (
                      <Link href={`/editor/${project.id}`}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
