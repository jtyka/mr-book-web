"use client";

import { ColumnDef } from "@tanstack/react-table";
import { BookDto } from "@/lib/api";
import { formatReadingDate } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookCheck, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ColumnActions {
  onEdit: (book: BookDto) => void;
  onDelete: (book: BookDto) => void;
  onMarkRead: (book: BookDto) => void;
}

export function createBookColumns({ onEdit, onDelete, onMarkRead }: ColumnActions): ColumnDef<BookDto>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Alle auswählen"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Zeile auswählen"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: "Titel",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.title}</span>
      ),
    },
    {
      id: "authors",
      header: "Autoren",
      cell: ({ row }) =>
        row.original.authors.map((a) => `${a.firstName} ${a.lastName}`).join(", ") || "–",
    },
    {
      accessorKey: "publishedYear",
      header: "Jahr",
      cell: ({ row }) => row.original.publishedYear ?? "–",
    },
    {
      id: "categories",
      header: "Kategorien",
      cell: ({ row }) =>
        row.original.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.original.categories.map((c) => (
              <Badge key={c.id} variant="secondary">{c.name}</Badge>
            ))}
          </div>
        ) : (
          "–"
        ),
    },
    {
      accessorKey: "rating",
      header: "Bewertung",
      cell: ({ row }) =>
        row.original.rating != null ? (
          <span className="font-medium">{row.original.rating}/10</span>
        ) : (
          "–"
        ),
    },
    {
      id: "read",
      header: "Gelesen",
      cell: ({ row }) => {
        const records = row.original.readingHistory;
        if (records.length === 0) return <Badge variant="outline">Nein</Badge>;
        const latest = records
          .filter((r) => r.readAt != null)
          .sort((a, b) => (a.readAt! < b.readAt! ? 1 : -1))
          .at(0);
        return (
          <div className="flex items-center gap-2">
            <Badge variant="default">
              {records.length > 1 ? `${records.length}×` : "Ja"}
            </Badge>
            {latest && (
              <span className="text-muted-foreground text-xs">
                {formatReadingDate(latest.readAt, latest.readAtPrecision)}
              </span>
            )}
          </div>
        );
      },
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
            <DropdownMenuItem onClick={() => onMarkRead(row.original)}>
              <BookCheck className="h-4 w-4 mr-2" /> Als gelesen markieren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ];
}
