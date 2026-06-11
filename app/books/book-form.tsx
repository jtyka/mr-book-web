"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authorsApi, booksApi, categoriesApi, publishersApi, BookDto, BookCreateDto, DatePrecision } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Teildatum: nur ausfüllen, was bekannt ist (Jahr → Monat → Tag)
interface DateParts {
  year: string;
  month: string;
  day: string;
}

const EMPTY_PARTS: DateParts = { year: "", month: "", day: "" };

function toDateAndPrecision(p: DateParts): {
  date: string | null;
  precision: DatePrecision | null;
} {
  if (!p.year) return { date: null, precision: null };
  const precision: DatePrecision = p.day ? "DAY" : p.month ? "MONTH" : "YEAR";
  const month = (p.month || "1").padStart(2, "0");
  const day = (p.day || "1").padStart(2, "0");
  return { date: `${p.year}-${month}-${day}`, precision };
}

function toParts(iso: string | null, precision: DatePrecision | null): DateParts {
  if (!iso) return EMPTY_PARTS;
  const [year, month, day] = iso.slice(0, 10).split("-");
  const p = precision ?? "DAY";
  return {
    year: String(Number(year)),
    month: p === "YEAR" ? "" : String(Number(month)),
    day: p === "DAY" ? String(Number(day)) : "",
  };
}

function DatePartsInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateParts;
  onChange: (v: DateParts) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Input
          type="number"
          placeholder="Jahr"
          min={1000}
          max={9999}
          className="w-20"
          value={value.year}
          onChange={(e) => {
            const year = e.target.value;
            onChange(year ? { ...value, year } : { ...EMPTY_PARTS });
          }}
        />
        <Select
          value={value.month || "none"}
          onValueChange={(v) =>
            !v || v === "none"
              ? onChange({ ...value, month: "", day: "" })
              : onChange({ ...value, month: v })
          }
        >
          <SelectTrigger className="w-20" disabled={!value.year}>
            <SelectValue placeholder="Monat">
              {value.month ? MONTHS[Number(value.month) - 1] : "Monat"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">–</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          placeholder="Tag"
          min={1}
          max={31}
          className="w-16"
          disabled={!value.month}
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
        />
      </div>
    </div>
  );
}

export function BookForm({ open, onClose, onSubmit, initial }: BookFormProps) {
  const queryClient = useQueryClient();
  const [isRead, setIsRead] = useState(false);
  const [startedParts, setStartedParts] = useState<DateParts>(EMPTY_PARTS);
  const [readParts, setReadParts] = useState<DateParts>(EMPTY_PARTS);
  // verhindert, dass ein Refetch während des Bearbeitens die Eingaben überschreibt
  const readStateInitialized = useRef(false);

  const { data: readingRecords } = useQuery({
    queryKey: ["reading-records", initial?.id],
    queryFn: () => booksApi.listReadingRecords(initial!.id),
    enabled: open && !!initial,
  });

  const invalidateRecords = () => {
    queryClient.invalidateQueries({ queryKey: ["reading-records", initial?.id] });
    queryClient.invalidateQueries({ queryKey: ["books"] });
  };

  // Gleicht den Lesestatus beim Speichern mit der DB ab: genau ein Eintrag,
  // wenn "gelesen", sonst keiner. Ohne Änderung bleibt alles unangetastet
  // (auch eventuelle Mehrfacheinträge).
  async function syncReadingRecord() {
    if (!initial) return;
    const existing = readingRecords ?? initial.readingHistory;
    const started = toDateAndPrecision(startedParts);
    const read = toDateAndPrecision(readParts);
    const desired = isRead
      ? { s: started.date, sp: started.precision, r: read.date, rp: read.precision }
      : null;
    const current = existing[0]
      ? {
          s: existing[0].startedAt?.slice(0, 10) ?? null,
          sp: existing[0].startedAt ? existing[0].startedAtPrecision ?? "DAY" : null,
          r: existing[0].readAt?.slice(0, 10) ?? null,
          rp: existing[0].readAt ? existing[0].readAtPrecision ?? "DAY" : null,
        }
      : null;
    if (JSON.stringify(desired) === JSON.stringify(current)) return;

    for (const r of existing) {
      await booksApi.deleteReadingRecord(initial.id, r.id);
    }
    if (desired) {
      await booksApi.addReadingRecord(initial.id, {
        startedAt: started.date,
        startedAtPrecision: started.precision,
        readAt: read.date,
        readAtPrecision: read.precision,
      });
    }
    invalidateRecords();
  }

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
      categoryIds: [],
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
        categoryIds: initial.categories.map((c) => c.id),
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
        categoryIds: [],
      });
    }
  }, [initial, open, reset]);

  useEffect(() => {
    if (!open) {
      readStateInitialized.current = false;
      return;
    }
    if (readStateInitialized.current) return;
    if (initial && !readingRecords) return; // auf geladene Einträge warten
    const rec = readingRecords?.[0];
    setIsRead(!!rec);
    setStartedParts(rec ? toParts(rec.startedAt, rec.startedAtPrecision) : EMPTY_PARTS);
    setReadParts(rec ? toParts(rec.readAt, rec.readAtPrecision) : EMPTY_PARTS);
    readStateInitialized.current = true;
  }, [open, initial, readingRecords]);

  const watchedAuthorIds = watch("authorIds") ?? [];
  const watchedCategoryIds = watch("categoryIds") ?? [];

  function toggleAuthor(id: number) {
    const current = watchedAuthorIds;
    if (current.includes(id)) {
      setValue("authorIds", current.filter((a) => a !== id));
    } else {
      setValue("authorIds", [...current, id]);
    }
  }

  function toggleCategory(id: number) {
    const current = watchedCategoryIds;
    if (current.includes(id)) {
      setValue("categoryIds", current.filter((c) => c !== id));
    } else {
      setValue("categoryIds", [...current, id]);
    }
  }

  async function handleFormSubmit(data: BookCreateDto) {
    try {
      await syncReadingRecord();
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
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

            <div className="col-span-2 space-y-1">
              <Label>Kategorien</Label>
              <div className="flex flex-wrap gap-2 border border-border rounded-md p-2 min-h-10">
                {(categories ?? []).map((c) => {
                  const selected = watchedCategoryIds.includes(c.id);
                  const label = c.parentName ? `${c.parentName} › ${c.name}` : c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {(categories ?? []).length === 0 && (
                  <span className="text-muted-foreground text-xs">
                    Noch keine Kategorien angelegt
                  </span>
                )}
              </div>
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

            {initial && (
              <div className="col-span-2 space-y-2">
                <Label>Lesestatus</Label>
                <div className="border border-border rounded-md p-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={isRead}
                      onCheckedChange={(v) => {
                        setIsRead(!!v);
                        if (!v) {
                          setStartedParts(EMPTY_PARTS);
                          setReadParts(EMPTY_PARTS);
                        }
                      }}
                    />
                    Gelesen
                  </label>
                  {isRead && (
                    <>
                      <div className="flex flex-wrap gap-4">
                        <DatePartsInput
                          label="Begonnen am"
                          value={startedParts}
                          onChange={setStartedParts}
                        />
                        <DatePartsInput
                          label="Gelesen am"
                          value={readParts}
                          onChange={setReadParts}
                        />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Daten optional – fülle nur aus, was Du weißt. Übernommen
                        wird alles beim Speichern.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
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
