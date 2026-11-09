"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present ⇒ edit mode; absent ⇒ create mode. */
  project?: { id: string; name: string; description: string | null };
  onSaved?: () => void;
}

export function ProjectDialog(props: ProjectDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {/* Remount the form each time the dialog opens so its fields are
            freshly seeded from props — no effect-based state syncing. */}
        {props.open ? <ProjectForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ onOpenChange, project, onSaved }: ProjectDialogProps) {
  const router = useRouter();
  const editing = Boolean(project);
  const [name, setName] = React.useState(project?.name ?? "");
  const [description, setDescription] = React.useState(
    project?.description ?? ""
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/projects/${project!.id}` : "/api/projects",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            description: description.trim()
              ? description
              : editing
                ? null
                : undefined,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Could not save the project.");
        return;
      }
      onOpenChange(false);
      onSaved?.();
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Few-shot plant disease recognition"
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="project-desc">Description (optional)</Label>
          <Textarea
            id="project-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this review about?"
          />
        </div>
        {error ? (
          <p className="text-sm text-[color:var(--destructive)]">{error}</p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={loading || name.trim().length === 0}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            {editing ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
