"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { publishersApi, PublisherDto, PublisherCreateDto } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function PublishersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editPublisher, setEditPublisher] = useState<PublisherDto | undefined>();
  const [deletePublisher, setDeletePublisher] = useState<PublisherDto | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["publishers", page, pageSize],
    queryFn: () => publishersApi.list(page, pageSize),
  });
  const publishers = data?.content ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["publishers"] });

  const createMutation = useMutation({
    mutationFn: (dto: PublisherCreateDto) => publishersApi.create(dto),
    onSuccess: () => { toast.success("Verlag angelegt"); invalidate(); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: PublisherCreateDto }) =>
      publishersApi.update(id, dto),
    onSuccess: () => { toast.success("Verlag gespeichert"); invalidate(); setFormOpen(false); setEditPublisher(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => publishersApi.delete(id),
    onSuccess: () => { toast.success("Verlag gelöscht"); invalidate(); setDeletePublisher(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<PublisherDto>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "country", header: "Land", cell: ({ row }) => row.original.country ?? "–" },
    {
      accessorKey: "website",
      header: "Website",
      cell: ({ row }) =>
        row.original.website ? (
          <a href={row.original.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {row.original.website}
          </a>
        ) : "–",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditPublisher(row.original); setFormOpen(true); }}>
              <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeletePublisher(row.original)}>
              <Trash2 className="h-4 w-4 mr-2" /> Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verlage</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.totalElements ?? 0} Verlage</p>
        </div>
        <Button onClick={() => { setEditPublisher(undefined); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Neuer Verlag
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={publishers}
        totalElements={data?.totalElements ?? 0}
        totalPages={data?.totalPages ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        isLoading={isLoading}
      />

      <PublisherForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditPublisher(undefined); }}
        onSubmit={async (dto) => {
          if (editPublisher) await updateMutation.mutateAsync({ id: editPublisher.id, dto });
          else await createMutation.mutateAsync(dto);
        }}
        initial={editPublisher}
      />

      <AlertDialog open={!!deletePublisher} onOpenChange={(o) => !o && setDeletePublisher(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Verlag löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deletePublisher?.name}" wird unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePublisher && deleteMutation.mutate(deletePublisher.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PublisherForm({
  open, onClose, onSubmit, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: PublisherCreateDto) => Promise<void>;
  initial?: PublisherDto;
}) {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<PublisherCreateDto>();
  useEffect(() => {
    if (open) reset(initial ?? { name: "", country: null, website: null, address: null });
  }, [open, initial, reset]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Verlag bearbeiten" : "Neuer Verlag"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (data) => { await onSubmit(data); })} className="space-y-4">
          <div className="space-y-1"><Label>Name *</Label><Input {...register("name", { required: true })} /></div>
          <div className="space-y-1"><Label>Land</Label><Input {...register("country")} /></div>
          <div className="space-y-1"><Label>Website</Label><Input {...register("website")} type="url" placeholder="https://…" /></div>
          <div className="space-y-1"><Label>Adresse</Label><textarea {...register("address")} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" placeholder="Straße, PLZ Ort" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={isSubmitting}>Speichern</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
