"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RowSelectionState } from "@tanstack/react-table";
import { toast } from "sonner";
import { booksApi, BookDto, BookCreateDto } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { createBookColumns } from "./columns";
import { BookForm } from "./book-form";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2 } from "lucide-react";

export default function BooksPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editBook, setEditBook] = useState<BookDto | undefined>();
  const [deleteBook, setDeleteBook] = useState<BookDto | undefined>();
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["books", page, pageSize],
    queryFn: () => booksApi.list(page, pageSize),
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
    mutationFn: (book: BookDto) =>
      booksApi.addReadingRecord(book.id, { startedAt: null, readAt: null }),
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

  async function handleFormSubmit(dto: BookCreateDto) {
    if (editBook) {
      await updateMutation.mutateAsync({ id: editBook.id, dto });
    } else {
      return createMutation.mutateAsync(dto);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bücher</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalElements} Bücher in der Bibliothek
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Einzeln löschen */}
      <AlertDialog open={!!deleteBook} onOpenChange={(o) => !o && setDeleteBook(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buch löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteBook?.title}" und alle Leseeinträge werden unwiderruflich
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
