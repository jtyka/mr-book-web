"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { authorsApi, categoriesApi, publishersApi, BookDto, BookCreateDto } from "@/lib/api";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface BookFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: BookCreateDto) => Promise<void>;
  initial?: BookDto;
}

export function BookForm({ open, onClose, onSubmit, initial }: BookFormProps) {
  const { data: authorsPage } = useQuery({
    queryKey: ["authors-all"],
    queryFn: () => authorsApi.list(0, 0),
    enabled: open,
  });
  const { data: publishersPage } = useQuery({
    queryKey: ["publishers-all"],
    queryFn: () => publishersApi.list(0, 0),
    enabled: open,
  });
  const { data: categories } = useQuery({
    queryKey: ["categories-flat"],
    queryFn: () => categoriesApi.list(),
    enabled: open,
  });

  const authors = authorsPage?.content ?? [];
  const publishers = publishersPage?.content ?? [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<BookCreateDto>({
    defaultValues: {
      title: "",
      isbn: null,
      pageCount: null,
      publishedYear: null,
      language: null,
      description: null,
      rating: null,
      review: null,
      authorIds: [],
      publisherId: null,
      categoryId: null,
    },
  });

  useEffect(() => {
    if (initial) {
      reset({
        title: initial.title,
        isbn: initial.isbn,
        pageCount: initial.pageCount,
        publishedYear: initial.publishedYear,
        language: initial.language,
        description: initial.description,
        rating: initial.rating,
        review: initial.review,
        authorIds: initial.authors.map((a) => a.id),
        publisherId: initial.publisher?.id ?? null,
        categoryId: initial.category?.id ?? null,
      });
    } else {
      reset({
        title: "",
        isbn: null,
        pageCount: null,
        publishedYear: null,
        language: null,
        description: null,
        rating: null,
        review: null,
        authorIds: [],
        publisherId: null,
        categoryId: null,
      });
    }
  }, [initial, open, reset]);

  const watchedAuthorIds = watch("authorIds") ?? [];

  function toggleAuthor(id: number) {
    const current = watchedAuthorIds;
    if (current.includes(id)) {
      setValue("authorIds", current.filter((a) => a !== id));
    } else {
      setValue("authorIds", [...current, id]);
    }
  }

  async function handleFormSubmit(data: BookCreateDto) {
    await onSubmit({
      ...data,
      pageCount: data.pageCount ? Number(data.pageCount) : null,
      publishedYear: data.publishedYear ? Number(data.publishedYear) : null,
      rating: data.rating ? Number(data.rating) : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Buch bearbeiten" : "Neues Buch"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="title">Titel *</Label>
              <Input id="title" {...register("title", { required: true })} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" {...register("isbn")} placeholder="978-…" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="language">Sprache</Label>
              <Input id="language" {...register("language")} placeholder="de" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="publishedYear">Erscheinungsjahr</Label>
              <Input
                id="publishedYear"
                type="number"
                {...register("publishedYear")}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="pageCount">Seitenzahl</Label>
              <Input id="pageCount" type="number" {...register("pageCount")} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rating">Bewertung (1–10)</Label>
              <Input
                id="rating"
                type="number"
                min={1}
                max={10}
                {...register("rating")}
              />
            </div>

            <div className="space-y-1">
              <Label>Verlag</Label>
              <Select
                value={watch("publisherId")?.toString() ?? "none"}
                onValueChange={(v) =>
                  setValue("publisherId", v === "none" ? null : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kein Verlag">
                    {publishers.find((p) => p.id === watch("publisherId"))?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">– Kein Verlag –</SelectItem>
                  {publishers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Kategorie</Label>
              <Select
                value={watch("categoryId")?.toString() ?? "none"}
                onValueChange={(v) =>
                  setValue("categoryId", v === "none" ? null : Number(v))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Keine Kategorie">
                    {(() => {
                      const c = (categories ?? []).find((c) => c.id === watch("categoryId"));
                      return c ? (c.parentName ? `${c.parentName} › ${c.name}` : c.name) : undefined;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">– Keine Kategorie –</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Autoren</Label>
              <div className="flex flex-wrap gap-2 border border-border rounded-md p-2 min-h-10">
                {authors.map((a) => {
                  const selected = watchedAuthorIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAuthor(a.id)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {a.firstName} {a.lastName}
                    </button>
                  );
                })}
                {authors.length === 0 && (
                  <span className="text-muted-foreground text-xs">
                    Noch keine Autoren angelegt
                  </span>
                )}
              </div>
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="description">Beschreibung</Label>
              <textarea
                id="description"
                {...register("description")}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="review">Rezension</Label>
              <textarea
                id="review"
                {...register("review")}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
