"use client";

import { useEffect, useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  ApiError,
  authorsApi,
  booksApi,
  publishersApi,
  AuthorDto,
  IsbnLookupDto,
  PagedResponse,
  PublisherDto,
} from "@/lib/api";
import {
  findAuthorByName,
  findPublisherByName,
  isValidIsbn,
  normalizeIsbn,
  splitAuthorName,
} from "@/lib/isbn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Aktuelle Formularwerte, gegen die die Vorschau vergleicht
export interface IsbnLookupFormValues {
  title: unknown;
  publishedYear: unknown;
  pageCount: unknown;
  language: unknown;
  description: unknown;
  authorIds: number[];
  publisherId: number | null;
}

// Was „Übernehmen" ins Formular schreiben soll (nur angehakte Felder gesetzt)
export interface IsbnApplyPatch {
  title?: string;
  publishedYear?: number;
  pageCount?: number;
  language?: string;
  description?: string;
  addAuthorIds: number[];
  publisherId?: number;
}

interface IsbnLookupProps {
  isbnInput: UseFormRegisterReturn;
  isbn: string | null | undefined;
  values: IsbnLookupFormValues;
  authors: AuthorDto[];
  publishers: PublisherDto[];
  // false, solange Autoren- und Verlagsliste nicht geladen sind: ohne sie
  // gälte jeder Eintrag als „neu" und würde doppelt angelegt.
  listsReady: boolean;
  onApply: (patch: IsbnApplyPatch) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  openlibrary: "Open Library",
  google: "Google Books",
};

const MSG_INVALID = "Das ist keine gültige ISBN.";
const MSG_NOT_FOUND = "Zu dieser ISBN wurde nichts gefunden.";
const MSG_UNAVAILABLE =
  "Die Buchdaten-Dienste sind gerade nicht erreichbar. Bitte später erneut versuchen.";

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400) return MSG_INVALID;
    if (e.status === 404) return MSG_NOT_FOUND;
    if (e.status === 429) {
      return e.retryAfter
        ? `Zu viele Anfragen. Bitte in ${e.retryAfter} Sekunden erneut versuchen.`
        : "Zu viele Anfragen. Bitte gleich noch einmal versuchen.";
    }
  }
  // 502, Netzfehler und alles Übrige
  return MSG_UNAVAILABLE;
}

const asText = (v: unknown) => (v == null ? "" : String(v)).trim();

// Die Vorschau liegt im Buch-Formular: Enter in ihren Eingabefeldern würde
// sonst das ganze Buch speichern.
function blockEnterSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.preventDefault();
}

export function IsbnLookup({
  isbnInput,
  isbn,
  values,
  authors,
  publishers,
  listsReady,
  onApply,
}: IsbnLookupProps) {
  const [loading, setLoading] = useState(false);
  // Meldung und Vorschau gehören zu der ISBN, für die sie geholt wurden;
  // ändert sich das Feld, werden sie nicht mehr angezeigt.
  const [message, setMessage] = useState<{ isbn: string; text: string } | null>(null);
  const [result, setResult] = useState<IsbnLookupDto | null>(null);
  const [resultIsbn, setResultIsbn] = useState("");

  const normalized = normalizeIsbn(isbn);
  const valid = isValidIsbn(isbn);

  // Aktuelle ISBN für spät eintreffende Antworten (Closure wäre veraltet)
  const currentIsbn = useRef(normalized);
  useEffect(() => {
    currentIsbn.current = normalized;
  }, [normalized]);

  async function lookup() {
    if (!valid || loading) return;
    const requested = normalized;
    setLoading(true);
    setMessage(null);
    setResult(null);
    try {
      const data = await booksApi.lookupIsbn(requested);
      if (currentIsbn.current !== requested) return; // ISBN inzwischen geändert
      setResult(data);
      setResultIsbn(requested);
    } catch (e) {
      if (currentIsbn.current !== requested) return;
      setMessage({ isbn: requested, text: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  const shownMessage = message && message.isbn === normalized ? message.text : null;
  const shownResult = result && resultIsbn === normalized ? result : null;
  // Ungültige, aber vollständig eingetippte ISBN: Hinweis statt Request. Eine
  // ISBN-13 ist beim Tippen zwischendurch 10 Zeichen lang – dann noch nicht.
  const complete =
    normalized.length >= 13 || (normalized.length === 10 && !/^97[89]/.test(normalized));
  const invalidHint = !valid && complete ? MSG_INVALID : null;

  return (
    <div className="col-span-2 space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="isbn">ISBN</Label>
          <Input id="isbn" {...isbnInput} placeholder="978-…" />
        </div>
        <Button type="button" variant="outline" disabled={!valid || loading} onClick={lookup}>
          <Search />
          {loading ? "Suche…" : "Nachschlagen"}
        </Button>
      </div>

      {(shownMessage ?? invalidHint) && (
        <p className="text-muted-foreground text-xs">{shownMessage ?? invalidHint}</p>
      )}

      {shownResult && !listsReady && (
        <p className="text-muted-foreground text-xs">
          Autoren und Verlage werden noch geladen …
        </p>
      )}

      {shownResult && listsReady && (
        <LookupPreview
          // neue Antwort = frischer Auswahlzustand
          key={`${resultIsbn}-${shownResult.title}-${shownResult.sources.join()}`}
          data={shownResult}
          values={values}
          authors={authors}
          publishers={publishers}
          onApply={onApply}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}

interface AuthorRow {
  firstName: string;
  lastName: string;
  checked: boolean;
}

function LookupPreview({
  data,
  values,
  authors,
  publishers,
  onApply,
  onClose,
}: {
  data: IsbnLookupDto;
  values: IsbnLookupFormValues;
  authors: AuthorDto[];
  publishers: PublisherDto[];
  onApply: (patch: IsbnApplyPatch) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  // Einfache Felder: nur die mit gefundenem Wert
  const scalarRows = (
    [
      { key: "title", label: "Titel", found: data.title },
      { key: "publishedYear", label: "Erscheinungsjahr", found: data.publishedYear },
      { key: "pageCount", label: "Seitenzahl", found: data.pageCount },
      { key: "language", label: "Sprache", found: data.language },
      { key: "description", label: "Beschreibung", found: data.description },
    ] as const
  )
    .filter((r) => r.found != null && String(r.found).trim() !== "")
    .map((r) => ({ ...r, newText: String(r.found).trim(), oldText: asText(values[r.key]) }));

  const [scalarChecked, setScalarChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scalarRows.map((r) => [r.key, r.oldText === ""]))
  );

  // Autoren: vorhanden oder neu (editierbar); Vorauswahl nur ohne bisherige Autoren
  const [authorRows, setAuthorRows] = useState<AuthorRow[]>(() =>
    data.authors.map((name) => {
      const { firstName, lastName } = splitAuthorName(name);
      const known = !!findAuthorByName(authors, name);
      return {
        firstName,
        lastName,
        checked: values.authorIds.length === 0 && (known || (!!firstName && !!lastName)),
      };
    })
  );
  // Zeilen, die schon beim Öffnen „vorhanden" waren, bekommen keine Eingabefelder
  const [knownAtStart] = useState(() => data.authors.map((n) => !!findAuthorByName(authors, n)));

  const [publisherName, setPublisherName] = useState(data.publisher?.trim() ?? "");
  const [publisherChecked, setPublisherChecked] = useState(
    () => values.publisherId == null && !!data.publisher?.trim()
  );
  const [knownPublisherAtStart] = useState(
    () => !!data.publisher && !!findPublisherByName(publishers, data.publisher)
  );

  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wird die Vorschau während des Anlegens entfernt (ISBN geändert, Dialog
  // geschlossen), darf apply() danach nichts mehr ins Formular schreiben.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Listen im Hintergrund auffrischen (Formular, Autoren- und Verlagsseite)
  function refreshLists() {
    for (const key of ["authors-all", "publishers-all", "authors", "publishers"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const authorState = authorRows.map((row) => {
    const full = `${row.firstName} ${row.lastName}`;
    const existing = findAuthorByName(authors, full);
    const canCheck = !!existing || (!!row.firstName.trim() && !!row.lastName.trim());
    return { existing, canCheck, checked: row.checked && canCheck };
  });
  const existingPublisher = findPublisherByName(publishers, publisherName);
  const canCheckPublisher = !!existingPublisher || publisherName.trim() !== "";
  const publisherSelected = publisherChecked && canCheckPublisher;

  const anySelected =
    scalarRows.some((r) => scalarChecked[r.key]) ||
    authorState.some((a) => a.checked) ||
    publisherSelected;

  function updateAuthor(i: number, patch: Partial<AuthorRow>) {
    setAuthorRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function apply() {
    setApplying(true);
    setError(null);
    // lokal gemerkt, damit zwei Zeilen mit gleichem Namen nicht doppelt angelegt werden
    const created = new Map<string, number>();
    const authorIds: number[] = [];
    let publisherId: number | undefined;
    let current = "";
    try {
      for (let i = 0; i < authorRows.length; i++) {
        const st = authorState[i];
        if (!st.checked) continue;
        if (st.existing) {
          authorIds.push(st.existing.id);
          continue;
        }
        const row = authorRows[i];
        const first = row.firstName.trim();
        const last = row.lastName.trim();
        current = `Autor „${first} ${last}"`;
        const key = `${first} ${last}`.toLowerCase();
        let id = created.get(key);
        if (id === undefined) {
          const author = await authorsApi.create({
            firstName: first,
            lastName: last,
            birthDate: null,
            nationality: null,
            email: null,
            website: null,
          });
          id = author.id;
          created.set(key, id);
          // sofort im Cache ergänzen: Folgeklick erkennt ihn als „vorhanden"
          queryClient.setQueryData<PagedResponse<AuthorDto>>(["authors-all"], (old) =>
            old
              ? { ...old, content: [...old.content, author], totalElements: old.totalElements + 1 }
              : old
          );
        }
        authorIds.push(id);
      }
      if (publisherSelected) {
        if (existingPublisher) {
          publisherId = existingPublisher.id;
        } else {
          const name = publisherName.trim();
          current = `Verlag „${name}"`;
          const publisher = await publishersApi.create({
            name,
            country: null,
            website: null,
            address: null,
          });
          publisherId = publisher.id;
          queryClient.setQueryData<PagedResponse<PublisherDto>>(["publishers-all"], (old) =>
            old
              ? {
                  ...old,
                  content: [...old.content, publisher],
                  totalElements: old.totalElements + 1,
                }
              : old
          );
        }
      }
    } catch (e) {
      console.error("[ISBN-Lookup] Anlegen fehlgeschlagen:", e);
      // schon angelegte Einträge sollen überall sichtbar sein
      refreshLists();
      if (!alive.current) return;
      setError(`${current} konnte nicht angelegt werden. Bitte erneut versuchen.`);
      setApplying(false);
      return;
    }

    refreshLists();
    if (!alive.current) return;

    const patch: IsbnApplyPatch = { addAuthorIds: authorIds, publisherId };
    for (const r of scalarRows) {
      if (!scalarChecked[r.key]) continue;
      if (r.key === "publishedYear" || r.key === "pageCount") patch[r.key] = Number(r.found);
      else patch[r.key] = r.newText;
    }
    onApply(patch);
    onClose();
  }

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <ul className="space-y-2">
        {scalarRows.map((r) => (
          <li key={r.key} className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              aria-label={r.label}
              checked={!!scalarChecked[r.key]}
              onCheckedChange={(v) => setScalarChecked((c) => ({ ...c, [r.key]: !!v }))}
            />
            <div className="min-w-0 flex-1">
              <span className="text-muted-foreground text-xs">{r.label}</span>
              <p
                className={`break-words ${r.key === "description" ? "line-clamp-3" : ""}`}
                title={r.key === "description" ? r.newText : undefined}
              >
                {r.newText}
              </p>
              {r.oldText !== "" && r.oldText !== r.newText && (
                <p
                  className={`text-muted-foreground text-xs break-words ${
                    r.key === "description" ? "line-clamp-2" : ""
                  }`}
                >
                  Bisher: {r.oldText}
                </p>
              )}
            </div>
          </li>
        ))}

        {authorRows.map((row, i) => {
          const st = authorState[i];
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                aria-label={`Autor ${data.authors[i]}`}
                checked={st.checked}
                disabled={!st.canCheck}
                onCheckedChange={(v) => updateAuthor(i, { checked: !!v })}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <span className="text-muted-foreground text-xs">Autor</span>
                <p className="break-words">
                  {data.authors[i]}{" "}
                  <span className="text-muted-foreground text-xs">
                    ({st.existing ? "vorhanden" : "neu"})
                  </span>
                </p>
                {!knownAtStart[i] && (
                  <div className="flex gap-2">
                    <Input
                      aria-label="Vorname"
                      placeholder="Vorname"
                      value={row.firstName}
                      onKeyDown={blockEnterSubmit}
                      onChange={(e) => updateAuthor(i, { firstName: e.target.value })}
                    />
                    <Input
                      aria-label="Nachname"
                      placeholder="Nachname"
                      value={row.lastName}
                      onKeyDown={blockEnterSubmit}
                      onChange={(e) => updateAuthor(i, { lastName: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}

        {data.publisher?.trim() && (
          <li className="flex items-start gap-2 text-sm">
            <Checkbox
              className="mt-0.5"
              aria-label="Verlag"
              checked={publisherSelected}
              disabled={!canCheckPublisher}
              onCheckedChange={(v) => setPublisherChecked(!!v)}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-muted-foreground text-xs">Verlag</span>
              <p className="break-words">
                {data.publisher}{" "}
                <span className="text-muted-foreground text-xs">
                  ({existingPublisher ? "vorhanden" : "neu"})
                </span>
              </p>
              {!knownPublisherAtStart && (
                <Input
                  aria-label="Verlagsname"
                  placeholder="Name des Verlags"
                  value={publisherName}
                  onKeyDown={blockEnterSubmit}
                  onChange={(e) => setPublisherName(e.target.value)}
                />
              )}
              {values.publisherId != null &&
                (() => {
                  const old = publishers.find((p) => p.id === values.publisherId);
                  return old && old.id !== existingPublisher?.id ? (
                    <p className="text-muted-foreground text-xs break-words">
                      Bisher: {old.name}
                    </p>
                  ) : null;
                })()}
            </div>
          </li>
        )}
      </ul>

      <p className="text-muted-foreground text-xs">
        Quelle: {data.sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ")}
      </p>

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={applying || !anySelected} onClick={apply}>
          {applying ? "Übernehmen…" : "Übernehmen"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={applying} onClick={onClose}>
          Verwerfen
        </Button>
      </div>
    </div>
  );
}
