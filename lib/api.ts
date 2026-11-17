// ============================================================================
// API Client – mr-book-api
// Base URL wird per Umgebungsvariable konfiguriert
// ============================================================================

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// ----------------------------------------------------------------------------
// Sitzung
// ----------------------------------------------------------------------------
// Das Session-Token liegt in einem HttpOnly-Cookie, das die API setzt. Das
// Frontend kann (und soll) es nicht lesen; alle Requests senden es per
// `credentials: "include"` automatisch mit.

// Altlast: frühere Versionen legten das Token in localStorage ab. Einmalig
// entfernen, damit dort kein gültiges Token mehr herumliegt.
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("mr-book-token");
  } catch {
    // localStorage nicht verfügbar (z. B. blockiert) — nichts zu bereinigen.
  }
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UserDto {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: UserDto;
  expiresAt: string;
}

export interface RegisterResponse {
  message: string;
  // Nur im Dev-Modus gesetzt, solange kein echter E-Mail-Versand angebunden ist.
  devVerifyUrl?: string;
}

export interface ResendVerificationResponse {
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
  // Nur lokal gesetzt (NODE_ENV !== "production" in der API), wenn das Konto existiert.
  devResetUrl?: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  children?: CategoryDto[];
}

export interface CategoryCreateDto {
  name: string;
  parentId: number | null;
}

export interface AuthorDto {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationality: string | null;
  email: string | null;
  website: string | null;
}

export interface AuthorCreateDto {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationality: string | null;
  email: string | null;
  website: string | null;
}

export interface PublisherDto {
  id: number;
  name: string;
  country: string | null;
  website: string | null;
  address: string | null;
}

export interface PublisherCreateDto {
  name: string;
  country: string | null;
  website: string | null;
  address: string | null;
}

export type DatePrecision = "DAY" | "MONTH" | "YEAR";

export interface ReadingRecordDto {
  id: number;
  startedAt: string | null;
  startedAtPrecision: DatePrecision | null;
  readAt: string | null;
  readAtPrecision: DatePrecision | null;
}

export interface ReadingRecordCreateDto {
  startedAt: string | null;
  startedAtPrecision?: DatePrecision | null;
  readAt: string | null;
  readAtPrecision?: DatePrecision | null;
}

export interface BookDto {
  id: number;
  title: string;
  isbn: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  language: string | null;
  description: string | null;
  rating: number | null;
  review: string | null;
  authors: AuthorDto[];
  publisher: PublisherDto | null;
  categories: CategoryDto[];
  readingHistory: ReadingRecordDto[];
  // Öffentliche Adresse der eigenen Cover-Kopie (Blob-Speicher); wird nur über
  // die Cover-Endpunkte gesetzt, nie über create/update.
  coverUrl: string | null;
}

export interface BookCreateDto {
  title: string;
  isbn: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  language: string | null;
  description: string | null;
  rating: number | null;
  review: string | null;
  authorIds: number[];
  publisherId: number | null;
  categoryIds: number[];
}

// Ergebnis von GET /api/books/lookup (ISBN-Lookup)
export interface IsbnLookupDto {
  isbn: string;
  sources: ("google" | "openlibrary")[];
  title: string; // "" wenn kein Katalog einen Titel kennt
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  language: string | null;
  description: string | null;
  coverUrl: string | null;
}

// Antwort von POST /api/books/covers/backfill
export interface CoverBackfillResult {
  processed: number;
  found: number;
  lastId: number | null;
  remaining: number;
}

export interface StatsDto {
  totalBooks: number;
  totalAuthors: number;
  totalPublishers: number;
  totalCategories: number;
  totalReadingRecords: number;
  booksRead: number;
  averageRating: number | null;
  averagePageCount: number | null;
  booksByLanguage: CountEntry[];
  booksByRating: CountEntry[];
  booksByCategory: CountEntry[];
}

export interface CountEntry {
  label: string;
  count: number;
  children?: CountEntry[];
}

// ----------------------------------------------------------------------------
// Helper
// ----------------------------------------------------------------------------

// Fehler einer API-Antwort mit Statuscode; `retryAfter` (Sekunden) stammt aus
// dem Header `Retry-After`, sofern vorhanden und lesbar. Die Meldung bleibt
// wie bisher `API <status>: <text>`, bestehende Aufrufer sind nicht betroffen.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Liest das Feld `error` aus der JSON-Antwort eines ApiError (Meldung
// `API <status>: {"error":"…"}`); null, wenn keines vorhanden ist.
export function apiErrorText(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const match = err.message.match(/^API \d+: ([\s\S]*)$/);
  if (!match) return null;
  try {
    const body = JSON.parse(match[1]) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

// `noAuthRedirect`: 401 ist hier ein erwartbares Ergebnis (falsches Passwort,
// nicht angemeldet beim Start) und darf nicht zur Anmeldeseite navigieren.
interface RequestOptions extends RequestInit {
  noAuthRedirect?: boolean;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const { noAuthRedirect, ...init } = options ?? {};
  // Bei FormData darf kein Content-Type gesetzt werden: der Browser ergänzt
  // ihn selbst inklusive der multipart-Boundary.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init?.headers as Record<string, string>),
  };

  const method = (init?.method ?? "GET").toUpperCase();
  // Nur idempotente Methoden dürfen bei einem Netzwerkfehler automatisch
  // wiederholt werden. Ein POST könnte den Server trotz Verbindungsabbruch
  // bereits erreicht haben (nur die Antwort ging verloren) – ein erneuter
  // Versuch würde dann riskieren, den Datensatz zu duplizieren.
  const retryable = method === "GET" || method === "PUT" || method === "DELETE";
  // Bewusst allgemein formuliert: request() bedient alle Endpunkte, ein
  // Entwurfs-Rettungsnetz gibt es aber nur im Buch-Formular – hier darf also
  // nichts versprochen werden, was anderswo nicht gilt.
  const offlineMessage =
    method === "GET"
      ? "Keine Verbindung zum Server — bitte Verbindung prüfen und die Seite neu laden."
      : "Keine Verbindung zum Server — bitte Verbindung prüfen und erneut speichern.";

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (err) {
    // fetch wirft ausschließlich bei echten Netzwerkfehlern einen TypeError;
    // alles andere unverändert weitergeben, damit Programmierfehler nicht als
    // Verbindungsproblem getarnt werden.
    if (!(err instanceof TypeError)) throw err;
    if (!retryable) throw new Error(offlineMessage);
    // Eine im Leerlauf geschlossene Verbindung (ERR_CONNECTION_CLOSED) lässt
    // den ersten Versuch sofort scheitern – der zweite baut eine neue auf.
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers,
        credentials: "include",
      });
    } catch {
      throw new Error(offlineMessage);
    }
  }
  if (res.status === 401) {
    // Auf der Anmeldeseite selbst nie navigieren (sonst Reload-Schleife).
    if (!noAuthRedirect && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Nicht authentifiziert");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryAfter = Number.parseInt(res.headers.get("Retry-After") ?? "", 10);
    throw new ApiError(
      res.status,
      `API ${res.status}: ${text}`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function pagedParams(
  page: number,
  size: number,
  sort?: string,
  dir?: "asc" | "desc"
): string {
  const p = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  return p.toString();
}

// ----------------------------------------------------------------------------
// Books
// ----------------------------------------------------------------------------

export const booksApi = {
  list: (
    page = 0,
    size = 20,
    sort = "title",
    dir: "asc" | "desc" = "asc",
    categoryId?: number | null
  ) =>
    request<PagedResponse<BookDto>>(
      `/api/books?${pagedParams(page, size, sort, dir)}${
        categoryId != null ? `&categoryId=${categoryId}` : ""
      }`
    ),

  get: (id: number) => request<BookDto>(`/api/books/${id}`),

  lookupIsbn: (isbn: string) =>
    request<IsbnLookupDto>(`/api/books/lookup?isbn=${encodeURIComponent(isbn)}`),

  create: (dto: BookCreateDto) =>
    request<BookDto>("/api/books", { method: "POST", body: JSON.stringify(dto) }),

  update: (id: number, dto: BookCreateDto) =>
    request<BookDto>(`/api/books/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  delete: (id: number) => request<void>(`/api/books/${id}`, { method: "DELETE" }),

  bulkDelete: (ids: number[]) =>
    request<number>("/api/books", {
      method: "DELETE",
      body: JSON.stringify(ids),
    }),

  // Eigenes Bild hochladen (bereits im Browser verkleinert, JPEG/PNG/WebP)
  uploadCover: (id: number, file: Blob) => {
    const form = new FormData();
    form.append("file", file, "cover.jpg");
    return request<BookDto>(`/api/books/${id}/cover`, { method: "PUT", body: form });
  },

  // Cover aus dem ISBN-Lookup übernehmen (die API lädt und speichert es selbst)
  importCover: (id: number, sourceUrl: string) =>
    request<BookDto>(`/api/books/${id}/cover/import`, {
      method: "POST",
      body: JSON.stringify({ sourceUrl }),
    }),

  deleteCover: (id: number) =>
    request<BookDto>(`/api/books/${id}/cover`, { method: "DELETE" }),

  // Sammelaktion: Cover für Bücher mit ISBN und ohne Cover nachladen
  // (`dryRun` zählt nur; sonst höchstens 5 Bücher je Aufruf)
  backfillCovers: (opts: { bookIds?: number[]; afterId?: number; dryRun?: boolean } = {}) =>
    request<CoverBackfillResult>("/api/books/covers/backfill", {
      method: "POST",
      body: JSON.stringify(opts),
    }),

  listReadingRecords: (bookId: number) =>
    request<ReadingRecordDto[]>(`/api/books/${bookId}/reading-records`),

  addReadingRecord: (bookId: number, dto: ReadingRecordCreateDto) =>
    request<ReadingRecordDto>(`/api/books/${bookId}/reading-records`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  deleteReadingRecord: (bookId: number, recordId: number) =>
    request<void>(`/api/books/${bookId}/reading-records/${recordId}`, {
      method: "DELETE",
    }),
};

// ----------------------------------------------------------------------------
// Authors
// ----------------------------------------------------------------------------

export const authorsApi = {
  list: (page = 0, size = 20, sort = "lastName", dir: "asc" | "desc" = "asc") =>
    request<PagedResponse<AuthorDto>>(
      `/api/authors?${pagedParams(page, size, sort, dir)}`
    ),

  get: (id: number) => request<AuthorDto>(`/api/authors/${id}`),

  create: (dto: AuthorCreateDto) =>
    request<AuthorDto>("/api/authors", { method: "POST", body: JSON.stringify(dto) }),

  update: (id: number, dto: AuthorCreateDto) =>
    request<AuthorDto>(`/api/authors/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  delete: (id: number) => request<void>(`/api/authors/${id}`, { method: "DELETE" }),
};

// ----------------------------------------------------------------------------
// Publishers
// ----------------------------------------------------------------------------

export const publishersApi = {
  list: (page = 0, size = 20, sort = "name", dir: "asc" | "desc" = "asc") =>
    request<PagedResponse<PublisherDto>>(
      `/api/publishers?${pagedParams(page, size, sort, dir)}`
    ),

  get: (id: number) => request<PublisherDto>(`/api/publishers/${id}`),

  create: (dto: PublisherCreateDto) =>
    request<PublisherDto>("/api/publishers", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  update: (id: number, dto: PublisherCreateDto) =>
    request<PublisherDto>(`/api/publishers/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  delete: (id: number) =>
    request<void>(`/api/publishers/${id}`, { method: "DELETE" }),
};

// ----------------------------------------------------------------------------
// Categories
// ----------------------------------------------------------------------------

export const categoriesApi = {
  list: () => request<CategoryDto[]>("/api/categories"),
  tree: () => request<CategoryDto[]>("/api/categories/tree"),
  get: (id: number) => request<CategoryDto>(`/api/categories/${id}`),

  create: (dto: CategoryCreateDto) =>
    request<CategoryDto>("/api/categories", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  update: (id: number, dto: CategoryCreateDto) =>
    request<CategoryDto>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(dto),
    }),

  delete: (id: number) =>
    request<void>(`/api/categories/${id}`, { method: "DELETE" }),
};

// ----------------------------------------------------------------------------
// Stats
// ----------------------------------------------------------------------------

export const statsApi = {
  get: () => request<StatsDto>("/api/stats"),
};

// ----------------------------------------------------------------------------
// Auth
// ----------------------------------------------------------------------------

export const authApi = {
  login: (email: string, password: string, rememberMe: boolean) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe }),
      noAuthRedirect: true,
    }),

  register: (email: string, password: string, name: string) =>
    request<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  verify: (token: string) =>
    request<AuthResponse>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
      noAuthRedirect: true,
    }),

  resendVerification: (email: string) =>
    request<ResendVerificationResponse>("/api/auth/verify/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // Passwort vergessen: fordert einen Link an (neutrale Antwort, egal ob es das
  // Konto gibt), prüft den Link und setzt das neue Passwort.
  forgotPassword: (email: string) =>
    request<ForgotPasswordResponse>("/api/auth/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
      noAuthRedirect: true,
    }),

  checkResetToken: (token: string) =>
    request<void>("/api/auth/password/check", {
      method: "POST",
      body: JSON.stringify({ token }),
      noAuthRedirect: true,
    }),

  resetPassword: (token: string, password: string) =>
    request<void>("/api/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      noAuthRedirect: true,
    }),

  logout: () =>
    request<void>("/api/auth/logout", { method: "POST", noAuthRedirect: true }),

  // Meldet alle Sitzungen des Benutzers ab, auch die aktuelle.
  logoutAll: () =>
    request<void>("/api/auth/logout-all", {
      method: "POST",
      noAuthRedirect: true,
    }),

  me: () =>
    request<{ user: UserDto }>("/api/auth/me", { noAuthRedirect: true }),
};
