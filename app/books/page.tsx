"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import { ApiError, booksApi, categoriesApi, BookDto, BookCreateDto, ReadingStatus } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { createBookColumns } from "./columns";
import { BookForm } from "./book-form";
import { coverErrorDetail } from "./cover-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ImageDown, Plus, Trash2 } from "lucide-react";

const STATUS_LABELS: Record<ReadingStatus, string> = {
  unread: "Ungelesen",
  reading: "Wird gelesen",
  read: "Gelesen",
};

export default function BooksPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editBook, setEditBook] = useState<BookDto | undefined>();
  const [deleteBook, setDeleteBook] = useState<BookDto | undefined>();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | null>(null);

  // Sammelaktion „Cover nachladen": confirmTotal = Rückfrage offen, run = läuft
  const [checkingCovers, setCheckingCovers] = useState(false);
  const [confirmTotal, setConfirmTotal] = useState<number | null>(null);
  const [run, setRun] = useState<{ total: number; processed: number; found: number } | null>(null);
  // Rückmeldung nach „Abbrechen", solange der laufende Aufruf noch zurückkommt
  const [cancelling, setCancelling] = useState(false);
  // „Abbrechen" wirkt nach dem laufenden Aufruf; beim Verlassen der Seite
  // ebenfalls, damit keine Schleife im Hintergrund weiterläuft.
  const cancelRef = useRef(false);
  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["books", page, pageSize, categoryFilter, statusFilter],
    queryFn: () =>
      booksApi.list(page, pageSize, "title", "asc", categoryFilter, statusFilter),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-flat"],
    queryFn: () => categoriesApi.list(),
  });

  const books = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["books"] });

  const createMutation = useMutation({
    mutationFn: (dto: BookCreateDto) => booksApi.create(dto),
    onSuccess: () => { toast.success("Buch angelegt"); invalidate(); setFormOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: BookCreateDto }) =>
      booksApi.update(id, dto),
    onSuccess: () => { toast.success("Buch gespeichert"); invalidate(); setFormOpen(false); setEditBook(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => booksApi.delete(id),
    onSuccess: () => { toast.success("Buch gelöscht"); invalidate(); setDeleteBook(undefined); },
    onError: (e: Error) => toast.error(e.message),
  });

  const markReadMutation = useMutation({
    mutationFn: (book: BookDto) => {
      // Laufender Eintrag („Wird gelesen“): abschließen statt zweiten anzulegen
      const open = book.readingHistory.find((r) => !r.finished);
      if (open) {
        return booksApi.updateReadingRecord(book.id, open.id, { finished: true });
      }
      return booksApi.addReadingRecord(book.id, {
        startedAt: null,
        readAt: null,
        finished: true,
      });
    },
    onSuccess: (_, book) => {
      toast.success(`„${book.title}" als gelesen markiert`);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["reading-records", book.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => booksApi.bulkDelete(ids),
    onSuccess: (count) => {
      toast.success(`${count} Bücher gelöscht`);
      invalidate();
      setRowSelection({});
      setBulkDeleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((idx) => books[Number(idx)]?.id)
    .filter(Boolean) as number[];

  const columns = createBookColumns({
    onEdit: (book) => { setEditBook(book); setFormOpen(true); },
    onDelete: (book) => setDeleteBook(book),
    onMarkRead: (book) => markReadMutation.mutate(book),
  });

  // Zählt die Bücher mit ISBN und ohne Cover (nur Auswahl, falls vorhanden)
  async function startCoverBackfill() {
    setCheckingCovers(true);
    try {
      const bookIds = selectedIds.length > 0 ? selectedIds : undefined;
      const { remaining } = await booksApi.backfillCovers({ bookIds, dryRun: true });
      if (remaining === 0) {
        toast.info("Alle Bücher mit ISBN haben bereits ein Cover.");
      } else {
        setConfirmTotal(remaining);
      }
    } catch (e) {
      toast.error(coverErrorDetail(e) ?? "Die Cover-Suche konnte nicht gestartet werden.");
    } finally {
      setCheckingCovers(false);
    }
  }

  async function runCoverBackfill(total: number) {
    const bookIds = selectedIds.length > 0 ? selectedIds : undefined;
    cancelRef.current = false;
    setCancelling(false);
    setConfirmTotal(null);
    setRun({ total, processed: 0, found: 0 });
    let processed = 0;
    let found = 0;
    let afterId: number | undefined;
    let failure: unknown = null;
    try {
      while (!cancelRef.current) {
        let r;
        try {
          r = await booksApi.backfillCovers({ bookIds, afterId });
        } catch (e) {
          // Rate-Limit mitten im Lauf: Wartezeit abwarten (abbrechbar) und
          // an derselben Stelle fortsetzen statt den ganzen Lauf zu verwerfen.
          if (e instanceof ApiError && e.status === 429 && e.retryAfter) {
            const until = Date.now() + e.retryAfter * 1000;
            while (!cancelRef.current && Date.now() < until) {
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
            continue;
          }
          throw e;
        }
        processed += r.processed;
        found += r.found;
        setRun({ total, processed, found });
        // processed === 0 als Notbremse gegen eine Endlosschleife
        if (r.remaining === 0 || r.lastId == null || r.processed === 0) break;
        afterId = r.lastId;
      }
    } catch (e) {
      failure = e;
    }
    setRun(null);
    setCancelling(false);
    invalidate();
    if (failure) {
      const detail = coverErrorDetail(failure) ?? (failure as Error).message;
      toast.error(
        `Abgebrochen nach ${processed} von ${total} Büchern (${found} Cover gefunden). ${detail}`
      );
    } else if (cancelRef.current) {
      toast.info(`Abgebrochen: ${found} Cover bei ${processed} von ${total} Büchern gefunden.`);
    } else {
      toast.success(`Für ${found} von ${total} Büchern ein Cover gefunden.`);
    }
  }

  async function handleFormSubmit(dto: BookCreateDto) {
    if (editBook) {
      return updateMutation.mutateAsync({ id: editBook.id, dto });
    } else {
      return createMutation.mutateAsync(dto);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bücher</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalElements} Bücher in der Bibliothek
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={checkingCovers || run !== null}
            onClick={startCoverBackfill}
          >
            <ImageDown className="h-4 w-4 mr-2" />
            {checkingCovers ? "Prüfe…" : "Cover nachladen"}
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {selectedIds.length} löschen
            </Button>
          )}
          <Button onClick={() => { setEditBook(undefined); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Buch
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={categoryFilter?.toString() ?? "all"}
          onValueChange={(v) => {
            setCategoryFilter(v === "all" ? null : Number(v));
            setPage(0);
            setRowSelection({});
          }}
        >
          <SelectTrigger className="w-64 max-w-full">
            <SelectValue placeholder="Alle Kategorien">
              {categoryFilter != null
                ? (() => {
                    const c = (categories ?? []).find((c) => c.id === categoryFilter);
                    if (!c) return undefined;
                    return c.parentName ? `${c.parentName} › ${c.name}` : c.name;
                  })()
                : "Alle Kategorien"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">– Alle Kategorien –</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter ?? "all"}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? null : (v as ReadingStatus));
            setPage(0);
            setRowSelection({});
          }}
        >
          <SelectTrigger className="w-48 max-w-full" aria-label="Lesestatus">
            <SelectValue placeholder="Lesestatus">
              {statusFilter ? STATUS_LABELS[statusFilter] : "Lesestatus: Alle"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Lesestatus: Alle</SelectItem>
            <SelectItem value="unread">Ungelesen</SelectItem>
            <SelectItem value="reading">Wird gelesen</SelectItem>
            <SelectItem value="read">Gelesen</SelectItem>
          </SelectContent>
        </Select>
        {(categoryFilter != null || statusFilter != null) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategoryFilter(null);
              setStatusFilter(null);
              setPage(0);
              setRowSelection({});
            }}
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={books}
        totalElements={totalElements}
        totalPages={totalPages}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        selectedRowIds={rowSelection}
        onRowSelectionChange={setRowSelection}
        isLoading={isLoading}
      />

      <BookForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditBook(undefined); }}
        onSubmit={handleFormSubmit}
        initial={editBook}
      />

      {/* Cover nachladen: Rückfrage */}
      <AlertDialog
        open={confirmTotal !== null}
        onOpenChange={(o) => !o && setConfirmTotal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cover nachladen</AlertDialogTitle>
            <AlertDialogDescription>
              Für {confirmTotal} Bücher ohne Cover suchen?
              {selectedIds.length > 0 && " Es werden nur die ausgewählten Bücher berücksichtigt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmTotal !== null && runCoverBackfill(confirmTotal)}
            >
              Suchen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cover nachladen: Fortschritt */}
      <AlertDialog
        open={run !== null}
        onOpenChange={(o) => {
          if (!o) {
            cancelRef.current = true;
            setCancelling(true);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelling ? "Wird abgebrochen …" : "Cover werden gesucht …"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {run?.processed ?? 0} von {run?.total ?? 0} · {run?.found ?? 0} Cover gefunden
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Abbrechen</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Einzeln löschen */}
      <AlertDialog open={!!deleteBook} onOpenChange={(o) => !o && setDeleteBook(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buch löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteBook?.title}“ und alle Leseeinträge werden unwiderruflich
              gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBook && deleteMutation.mutate(deleteBook.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk löschen */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedIds.length} Bücher löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die ausgewählten Bücher und alle zugehörigen Leseeinträge werden
              unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
            >
              Alle löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
