"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authorsApi, booksApi, categoriesApi, publishersApi, BookDto, BookCreateDto, DatePrecision } from "@/lib/api";
import { bookDraftKey, clearDraft, loadDraft, saveDraft } from "@/lib/draft";
import { useApiKeepalive } from "@/lib/use-api-keepalive";
import { useAuth } from "@/lib/auth-context";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface BookFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: BookCreateDto) => Promise<BookDto | void>;
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

// Entwurf: kompletter Formularzustand + Lesestatus, der debounced beim
// Bearbeiten lokal gesichert wird (Rettungsnetz bei Verbindungsabbrüchen).
interface BookDraftData {
  values: BookCreateDto;
  isRead: boolean;
  startedParts: DateParts;
  readParts: DateParts;
}

// Leeres Formular – Vorbelegung, Zurücksetzen und das Auffüllen eines
// unvollständigen Entwurfs greifen auf dieselbe Definition zu.
const EMPTY_BOOK_VALUES: BookCreateDto = {
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
};

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
  // true, sobald der Nutzer den Lesestatus selbst verändert (oder einen
  // Entwurf wiederherstellt) hat – steuert zusammen mit isDirty, ob ein
  // Entwurf gesichert werden soll
  const [readStatusTouched, setReadStatusTouched] = useState(false);

  // Solange der Dialog offen ist, die Verbindung zur API warm halten – ein
  // langes Formular ist sonst genau die Leerlaufphase, in der die Verbindung
  // geschlossen wird und der nächste Request sofort scheitert.
  useApiKeepalive(open);

  // Rettungsnetz: Formular-Entwurf in localStorage, falls das Speichern
  // fehlschlägt (z. B. Verbindungsabbruch). Der Key enthält die Nutzer-ID,
  // damit auf einem gemeinsam genutzten Browser niemand den Entwurf eines
  // anderen Kontos vorgelegt bekommt.
  const { user } = useAuth();
  const draftKey = useMemo(() => bookDraftKey(user?.id, initial?.id), [user?.id, initial?.id]);
  const [draftBanner, setDraftBanner] = useState<{ savedAt: string; data: BookDraftData } | null>(
    null
  );
  // verhindert, dass der Entwurf bei jedem Render erneut geprüft wird
  const draftCheckedRef = useRef(false);

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
    formState: { isSubmitting, isDirty },
  } = useForm<BookCreateDto>({
    defaultValues: EMPTY_BOOK_VALUES,
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
      reset(EMPTY_BOOK_VALUES);
    }
  }, [initial, open, reset]);

  useEffect(() => {
    if (!open) {
      readStateInitialized.current = false;
      draftCheckedRef.current = false;
      setReadStatusTouched(false);
      setDraftBanner(null);
      return;
    }
    if (readStateInitialized.current) return;
    if (initial && !readingRecords) return; // auf geladene Einträge warten
    const rec = readingRecords?.[0];
    setIsRead(!!rec);
    setStartedParts(rec ? toParts(rec.startedAt, rec.startedAtPrecision) : EMPTY_PARTS);
    setReadParts(rec ? toParts(rec.readAt, rec.readAtPrecision) : EMPTY_PARTS);
    setReadStatusTouched(false);
    readStateInitialized.current = true;
  }, [open, initial, readingRecords]);

  // Beim Öffnen einmalig prüfen, ob ein nicht gespeicherter Entwurf existiert.
  // Wird bewusst NICHT automatisch eingespielt – der Nutzer entscheidet per
  // Banner, ob er ihn wiederherstellen oder verwerfen möchte.
  useEffect(() => {
    if (!open) return;
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    setDraftBanner(loadDraft<BookDraftData>(draftKey));
  }, [open, draftKey]);

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

  // Gesamter Formularzustand inkl. Lesestatus – Grundlage für den Entwurf.
  // watch() ohne Argument abonniert alle Felder (auch unregistrierte
  // Texteingaben), damit wirklich nichts verloren geht.
  const formValues = watch();
  const hasUnsavedChanges = isDirty || readStatusTouched;

  // Entwurf debounced sichern, solange der Dialog offen ist und tatsächlich
  // etwas verändert wurde. Ein unangetastet geöffnetes Formular legt keinen
  // Entwurf an.
  // Während des Speicherns wird nicht gesichert: sonst könnte ein noch
  // laufender Debounce-Timer nach dem erfolgreichen clearDraft() feuern und
  // einen Entwurf für ein bereits gespeichertes Buch neu anlegen.
  useEffect(() => {
    if (!open || !hasUnsavedChanges || isSubmitting) return;
    const timer = setTimeout(() => {
      saveDraft<BookDraftData>(draftKey, {
        values: formValues,
        isRead,
        startedParts,
        readParts,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    open,
    hasUnsavedChanges,
    isSubmitting,
    draftKey,
    formValues,
    isRead,
    startedParts,
    readParts,
  ]);

  function handleRestoreDraft() {
    if (!draftBanner) return;
    const { data } = draftBanner;
    // Defensiv: ein beschädigter Entwurf oder einer aus einer älteren
    // Formularversion darf den Dialog nicht zerlegen – fehlende Felder werden
    // mit dem leeren Formular aufgefüllt.
    try {
      reset({ ...EMPTY_BOOK_VALUES, ...(data.values ?? {}) });
      setIsRead(!!data.isRead);
      setStartedParts(data.startedParts ?? EMPTY_PARTS);
      setReadParts(data.readParts ?? EMPTY_PARTS);
      setReadStatusTouched(true);
      // verhindert, dass ein später eintreffendes Refetch der Reading-Records
      // die gerade wiederhergestellten Werte sofort wieder überschreibt
      readStateInitialized.current = true;
    } catch {
      clearDraft(draftKey);
      toast.error("Der gespeicherte Entwurf konnte nicht wiederhergestellt werden.");
    }
    setDraftBanner(null);
  }

  function handleDiscardDraft() {
    clearDraft(draftKey);
    setDraftBanner(null);
  }

  async function handleFormSubmit(data: BookCreateDto) {
    try {
      await syncReadingRecord();
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    const created = await onSubmit({
      ...data,
      pageCount: data.pageCount ? Number(data.pageCount) : null,
      publishedYear: data.publishedYear ? Number(data.publishedYear) : null,
      rating: data.rating ? Number(data.rating) : null,
    });
    let readingRecordFailed = false;
    if (!initial && created && isRead) {
      const started = toDateAndPrecision(startedParts);
      const read = toDateAndPrecision(readParts);
      try {
        await booksApi.addReadingRecord(created.id, {
          startedAt: started.date,
          startedAtPrecision: started.precision,
          readAt: read.date,
          readAtPrecision: read.precision,
        });
        queryClient.invalidateQueries({ queryKey: ["books"] });
      } catch (e) {
        readingRecordFailed = true;
        toast.error(
          `Buch angelegt, aber der Lesestatus konnte nicht gespeichert werden: ${(e as Error).message}`
        );
      }
    }
    // Der Entwurf wird nur verworfen, wenn wirklich alles gespeichert ist.
    // Scheitert der Lesestatus-Record, bleibt er als Rettungsnetz liegen –
    // genau diese Angaben wären sonst verloren.
    if (!readingRecordFailed) clearDraft(draftKey);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Buch bearbeiten" : "Neues Buch"}</DialogTitle>
        </DialogHeader>

        {draftBanner && (
          <Alert>
            <AlertTitle>Nicht gespeicherter Entwurf gefunden</AlertTitle>
            <AlertDescription>
              <p>
                Entwurf vom {new Date(draftBanner.savedAt).toLocaleString("de-DE")}.
                Möchtest Du ihn wiederherstellen oder verwerfen?
              </p>
              <div className="flex gap-2 mt-2">
                <Button type="button" size="sm" onClick={handleRestoreDraft}>
                  Wiederherstellen
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleDiscardDraft}>
                  Verwerfen
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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

            <div className="col-span-2 space-y-2">
              <Label>Lesestatus</Label>
              <div className="border border-border rounded-md p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={isRead}
                    onCheckedChange={(v) => {
                      setIsRead(!!v);
                      setReadStatusTouched(true);
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
                        onChange={(v) => {
                          setStartedParts(v);
                          setReadStatusTouched(true);
                        }}
                      />
                      <DatePartsInput
                        label="Gelesen am"
                        value={readParts}
                        onChange={(v) => {
                          setReadParts(v);
                          setReadStatusTouched(true);
                        }}
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
          </div>

          <DialogFooter className="sm:justify-between">
            {/* Macht das Rettungsnetz sichtbar – nur hier gilt es, deshalb
                steht der Hinweis nicht in der allgemeinen Fehlermeldung. */}
            <p className="text-muted-foreground text-xs sm:mr-auto">
              {hasUnsavedChanges ? "Entwurf wird automatisch lokal gesichert." : ""}
            </p>
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
