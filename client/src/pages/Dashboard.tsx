import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Film, Plus, Trash2, Edit2, LogOut, Clock, Ratio, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("Untitled Project");
  const [newAspect, setNewAspect] = useState<"9:16" | "4:3">("9:16");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: projects, refetch } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createProject = trpc.projects.create.useMutation({
    onSuccess: (data) => { setShowNewProject(false); if (data?.id) navigate(`/editor/${data.id}`); },
    onError: (e) => toast.error(e.message),
  });

  const deleteProject = trpc.projects.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Project deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => { refetch(); setRenamingId(null); toast.success("Project renamed"); },
    onError: (e) => toast.error(e.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [loading, isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-7 h-7 text-primary" />
          <span className="text-xl font-bold">Comic Animator</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.name || user?.email}</span>
          <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/"); }} className="gap-2">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="flex-1 container py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Projects</h1>
          <Button onClick={() => setShowNewProject(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-6xl">🎬</div>
            <h2 className="text-xl font-semibold">No projects yet</h2>
            <p className="text-muted-foreground">Create your first comic animation project to get started.</p>
            <Button onClick={() => setShowNewProject(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors group"
              >
                {/* Thumbnail */}
                <div
                  className="bg-muted flex items-center justify-center cursor-pointer"
                  style={{ aspectRatio: project.aspectRatio === "9:16" ? "9/16" : "4/3", maxHeight: 200 }}
                  onClick={() => navigate(`/editor/${project.id}`)}
                >
                  <Film className="w-12 h-12 text-muted-foreground/40" />
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold truncate">{project.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Ratio className="w-3 h-3" />
                        {project.aspectRatio}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/editor/${project.id}`)}>
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setRenamingId(project.id); setRenameValue(project.name || ""); }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { if (confirm("Delete this project?")) deleteProject.mutate({ id: project.id }); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Comic Reel"
                onKeyDown={(e) => e.key === "Enter" && createProject.mutate({ name: newName, aspectRatio: newAspect })}
              />
            </div>
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={newAspect} onValueChange={(v) => setNewAspect(v as "9:16" | "4:3")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 — Vertical (Reels/Shorts)</SelectItem>
                  <SelectItem value="4:3">4:3 — Classic (Landscape)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProject(false)}>Cancel</Button>
            <Button
              onClick={() => createProject.mutate({ name: newName, aspectRatio: newAspect })}
              disabled={createProject.isPending}
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renamingId} onOpenChange={() => setRenamingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Project Name</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-2"
              onKeyDown={(e) => e.key === "Enter" && renamingId && updateProject.mutate({ id: renamingId, name: renameValue })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingId(null)}>Cancel</Button>
            <Button
              onClick={() => renamingId && updateProject.mutate({ id: renamingId, name: renameValue })}
              disabled={updateProject.isPending}
            >
              {updateProject.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
