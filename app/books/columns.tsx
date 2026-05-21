"use client";

import { ColumnDef } from "@tanstack/react-table";
import { BookDto } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ColumnActions {
  onEdit: (book: BookDto) => void;
  onDelete: (book: BookDto) => void;
}

export function createBookColumns({ onEdit, onDelete }: ColumnActions): ColumnDef<BookDto>[] {
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
      id: "category",
      header: "Kategorie",
      cell: ({ row }) =>
        row.original.category ? (
          <Badge variant="secondary">{row.original.category.name}</Badge>
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
      cell: ({ row }) =>
        row.original.readingHistory.length > 0 ? (
          <Badge variant="default">
            {row.original.readingHistory.length}×
          </Badge>
        ) : (
          <Badge variant="outline">Nein</Badge>
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
