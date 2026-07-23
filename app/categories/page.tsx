"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoriesApi, CategoryDto, CategoryCreateDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryDto | undefined>();
  const [deleteCategory, setDeleteCategory] = useState<CategoryDto | undefined>();

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ["categories-tree"],
    queryFn: () => categoriesApi.tree(),
  });
  const { data: flat = [] } = useQuery({
    queryKey: ["categories-flat"],
    queryFn: () => categoriesApi.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["categories-tree"] });
    queryClient.invalidateQueries({ queryKey: ["categories-flat"] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CategoryCreateDto) => categoriesApi.create(dto),
    onSuccess: () => { toast.success("Kategorie angelegt"); invalidate(); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: CategoryCreateDto }) =>
      categoriesApi.update(id, dto),
    onSuccess: () => { toast.success("Kategorie gespeichert"); invalidate(); setFormOpen(false); setEditCategory(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.delete(id),
    onSuccess: () => { toast.success("Kategorie gelöscht"); invalidate(); setDeleteCategory(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategorien</h1>
          <p className="text-muted-foreground text-sm mt-1">{flat.length} Kategorien gesamt</p>
        </div>
        <Button onClick={() => { setEditCategory(undefined); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Neue Kategorie
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laden…</p>
      ) : (
        <div className="space-y-2">
          {tree.map((root) => (
            <CategoryNode
              key={root.id}
              node={root}
              depth={0}
              onEdit={(c) => { setEditCategory(c); setFormOpen(true); }}
              onDelete={setDeleteCategory}
            />
          ))}
        </div>
      )}

      <CategoryForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCategory(undefined); }}
        onSubmit={async (dto) => {
          if (editCategory) await updateMutation.mutateAsync({ id: editCategory.id, dto });
          else await createMutation.mutateAsync(dto);
        }}
        initial={editCategory}
        allCategories={flat}
        editingId={editCategory?.id}
      />

      <AlertDialog open={!!deleteCategory} onOpenChange={(o) => !o && setDeleteCategory(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteCategory?.name}“ wird gelöscht. Kindkategorien werden dem Elternelement zugeordnet.
              Bücher in dieser Kategorie verlieren ihre Kategorie-Zuordnung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryNode({
  node,
  depth,
  onEdit,
  onDelete,
}: {
  node: CategoryDto;
  depth: number;
  onEdit: (c: CategoryDto) => void;
  onDelete: (c: CategoryDto) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 group"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
            <ChevronRight
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : (
          <span className="w-4 h-4 inline-block" />
        )}
        <span className="flex-1 font-medium">{node.name}</span>
        {depth === 0 && <Badge variant="outline" className="text-xs">Hauptkategorie</Badge>}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(node)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <CategoryNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  open,
  onClose,
  onSubmit,
  initial,
  allCategories,
  editingId,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: CategoryCreateDto) => Promise<void>;
  initial?: CategoryDto;
  allCategories: CategoryDto[];
  editingId?: number;
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<CategoryCreateDto>({
    defaultValues: { name: "", parentId: null },
  });

  useState(() => {
    if (open) {
      reset({ name: initial?.name ?? "", parentId: initial?.parentId ?? null });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (data) => { await onSubmit(data); })} className="space-y-4">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input {...register("name", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Übergeordnete Kategorie</Label>
            <Select
              value={watch("parentId")?.toString() ?? "none"}
              onValueChange={(v) => setValue("parentId", v === "none" ? null : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="– Hauptkategorie –" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">– Hauptkategorie –</SelectItem>
                {allCategories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={isSubmitting}>Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
