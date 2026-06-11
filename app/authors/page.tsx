"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authorsApi, AuthorDto, AuthorCreateDto } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

export default function AuthorsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [editAuthor, setEditAuthor] = useState<AuthorDto | undefined>();
  const [deleteAuthor, setDeleteAuthor] = useState<AuthorDto | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["authors", page, pageSize],
    queryFn: () => authorsApi.list(page, pageSize),
  });
  const authors = data?.content ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["authors"] });

  const createMutation = useMutation({
    mutationFn: (dto: AuthorCreateDto) => authorsApi.create(dto),
    onSuccess: () => { toast.success("Autor angelegt"); invalidate(); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: AuthorCreateDto }) =>
      authorsApi.update(id, dto),
    onSuccess: () => { toast.success("Autor gespeichert"); invalidate(); setFormOpen(false); setEditAuthor(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => authorsApi.delete(id),
    onSuccess: () => { toast.success("Autor gelöscht"); invalidate(); setDeleteAuthor(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<AuthorDto>[] = [
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    { accessorKey: "nationality", header: "Nationalität", cell: ({ row }) => row.original.nationality ?? "–" },
    { accessorKey: "birthDate", header: "Geburtsdatum", cell: ({ row }) => row.original.birthDate ? row.original.birthDate.slice(0, 10) : "–" },
    {
      accessorKey: "website",
      header: "Webseite",
      cell: ({ row }) =>
        row.original.website ? (
          <a href={row.original.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {row.original.website}
          </a>
        ) : (
          "–"
        ),
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
            <DropdownMenuItem onClick={() => { setEditAuthor(row.original); setFormOpen(true); }}>
              <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteAuthor(row.original)}>
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
          <h1 className="text-2xl font-bold">Autoren</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.totalElements ?? 0} Autoren</p>
        </div>
        <Button onClick={() => { setEditAuthor(undefined); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Neuer Autor
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={authors}
        totalElements={data?.totalElements ?? 0}
        totalPages={data?.totalPages ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        isLoading={isLoading}
      />

      <AuthorForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditAuthor(undefined); }}
        onSubmit={async (dto) => {
          if (editAuthor) await updateMutation.mutateAsync({ id: editAuthor.id, dto });
          else await createMutation.mutateAsync(dto);
        }}
        initial={editAuthor}
      />

      <AlertDialog open={!!deleteAuthor} onOpenChange={(o) => !o && setDeleteAuthor(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Autor löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteAuthor?.firstName} {deleteAuthor?.lastName}" wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAuthor && deleteMutation.mutate(deleteAuthor.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AuthorForm({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: AuthorCreateDto) => Promise<void>;
  initial?: AuthorDto;
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<AuthorCreateDto>();

  useEffect(() => {
    if (open) {
      reset(initial ?? { firstName: "", lastName: "", birthDate: null, nationality: null, email: null, website: null });
    }
  }, [open, initial, reset]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Autor bearbeiten" : "Neuer Autor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(async (data) => { await onSubmit(data); })} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Vorname *</Label>
              <Input {...register("firstName", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Nachname *</Label>
              <Input {...register("lastName", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Geburtsdatum</Label>
              <Input type="date" {...register("birthDate")} />
            </div>
            <div className="space-y-1">
              <Label>Nationalität</Label>
              <Select
                value={watch("nationality") ?? "none"}
                onValueChange={(v) =>
                  setValue("nationality", v === "none" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Angabe">
                    {watch("nationality") ?? undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">– Keine Angabe –</SelectItem>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>E-Mail</Label>
            <Input type="email" {...register("email")} placeholder="autor@beispiel.de" />
          </div>
          <div className="space-y-1">
            <Label>Webseite</Label>
            <Input type="url" {...register("website")} placeholder="https://…" />
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

const COUNTRIES = [
  "Afghanistan", "Ägypten", "Albanien", "Algerien", "Andorra", "Angola",
  "Antigua und Barbuda", "Äquatorialguinea", "Argentinien", "Armenien",
  "Aserbaidschan", "Äthiopien", "Australien", "Bahamas", "Bahrain",
  "Bangladesch", "Barbados", "Belgien", "Belize", "Benin", "Bhutan",
  "Bolivien", "Bosnien und Herzegowina", "Botswana", "Brasilien", "Brunei",
  "Bulgarien", "Burkina Faso", "Burundi", "Chile", "China", "Costa Rica",
  "Côte d'Ivoire", "Dänemark", "Deutschland", "Dominica",
  "Dominikanische Republik", "Dschibuti", "Ecuador", "El Salvador",
  "Eritrea", "Estland", "Eswatini", "Fidschi", "Finnland", "Frankreich",
  "Gabun", "Gambia", "Georgien", "Ghana", "Grenada", "Griechenland",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
  "Indien", "Indonesien", "Irak", "Iran", "Irland", "Island", "Israel",
  "Italien", "Jamaika", "Japan", "Jemen", "Jordanien", "Kambodscha",
  "Kamerun", "Kanada", "Kap Verde", "Kasachstan", "Katar", "Kenia",
  "Kirgisistan", "Kiribati", "Kolumbien", "Komoren", "Kongo",
  "Kongo (Dem. Rep.)", "Kosovo", "Kroatien", "Kuba", "Kuwait", "Laos",
  "Lesotho", "Lettland", "Libanon", "Liberia", "Libyen", "Liechtenstein",
  "Litauen", "Luxemburg", "Madagaskar", "Malawi", "Malaysia", "Malediven",
  "Mali", "Malta", "Marokko", "Marshallinseln", "Mauretanien", "Mauritius",
  "Mexiko", "Mikronesien", "Moldau", "Monaco", "Mongolei", "Montenegro",
  "Mosambik", "Myanmar", "Namibia", "Nauru", "Nepal", "Neuseeland",
  "Nicaragua", "Niederlande", "Niger", "Nigeria", "Nordkorea",
  "Nordmazedonien", "Norwegen", "Oman", "Österreich", "Osttimor",
  "Pakistan", "Palau", "Panama", "Papua-Neuguinea", "Paraguay", "Peru",
  "Philippinen", "Polen", "Portugal", "Ruanda", "Rumänien", "Russland",
  "Salomonen", "Sambia", "Samoa", "San Marino", "São Tomé und Príncipe",
  "Saudi-Arabien", "Schweden", "Schweiz", "Senegal", "Serbien",
  "Seychellen", "Sierra Leone", "Simbabwe", "Singapur", "Slowakei",
  "Slowenien", "Somalia", "Spanien", "Sri Lanka", "St. Kitts und Nevis",
  "St. Lucia", "St. Vincent und die Grenadinen", "Südafrika", "Sudan",
  "Südkorea", "Südsudan", "Suriname", "Syrien", "Tadschikistan", "Taiwan",
  "Tansania", "Thailand", "Togo", "Tonga", "Trinidad und Tobago", "Tschad",
  "Tschechien", "Tunesien", "Türkei", "Turkmenistan", "Tuvalu", "Uganda",
  "Ukraine", "Ungarn", "Uruguay", "USA", "Usbekistan", "Vanuatu",
  "Vatikanstadt", "Venezuela", "Vereinigte Arabische Emirate",
  "Vereinigtes Königreich", "Vietnam", "Zentralafrikanische Republik",
  "Zypern",
];
