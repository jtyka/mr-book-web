// ============================================================================
// API Client – mr-book-api
// Base URL wird per Umgebungsvariable konfiguriert
// ============================================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// ----------------------------------------------------------------------------
// Auth Token Management
// ----------------------------------------------------------------------------

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("mr-book-token", token);
  } else {
    localStorage.removeItem("mr-book-token");
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("mr-book-token");
  }
  return authToken;
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
  token: string;
  expiresAt: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (res.status === 401) {
    setAuthToken(null);
    window.location.href = "/login";
    throw new Error("Nicht authentifiziert");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
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
  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  logout: () =>
    request<void>("/api/auth/logout", { method: "POST" }),

  me: () => request<{ user: UserDto }>("/api/auth/me"),
};
