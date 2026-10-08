// ============================================================================
// Formular-Entwürfe – rettet Eingaben lokal (localStorage), falls ein Speichern
// fehlschlägt (z. B. Verbindungsabbruch). Bewusst sehr defensiv: ein Fehler
// hier darf die App niemals zum Absturz bringen (Private Mode, voller/
// gesperrter Storage, SSR, …).
// ============================================================================

interface StoredDraft<T> {
  savedAt: string;
  data: T;
}

// Entwürfe, die älter als das hier sind, gelten als nicht mehr relevant
// und werden beim Laden verworfen und aufgeräumt.
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Speichert einen Entwurf unter dem angegebenen Key. SSR-sicher und
// fehlertolerant (z. B. Private Mode / Storage voll).
export function saveDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredDraft<T> = { savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Entwurf konnte nicht gespeichert werden – kein Grund, die App abstürzen
    // zu lassen, es handelt sich nur um ein Rettungsnetz.
  }
}

// Lädt einen Entwurf. Gibt null zurück, wenn keiner existiert, er beschädigt
// ist oder älter als 7 Tage ist (in diesem Fall wird er zugleich entfernt).
export function loadDraft<T>(key: string): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    // Nur verwenden, wenn der Eintrag auch wirklich die erwartete Form hat –
    // ein fremder oder beschädigter Wert unter diesem Key darf nicht als
    // Entwurf angeboten werden.
    if (!parsed?.savedAt || typeof parsed.data !== "object" || parsed.data === null) {
      return null;
    }
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (Number.isNaN(age) || age > DRAFT_MAX_AGE_MS) {
      clearDraft(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Entfernt einen Entwurf (z. B. nach erfolgreichem Speichern oder wenn der
// Nutzer ihn bewusst verwirft).
export function clearDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignorieren – betrifft nur das Rettungsnetz
  }
}

// ----------------------------------------------------------------------------
// Key-Helfer
// ----------------------------------------------------------------------------

// Liefert den Storage-Key für den Entwurf eines Buch-Formulars: ohne bookId
// für ein neu angelegtes Buch, mit bookId beim Bearbeiten eines bestehenden
// Buchs. Die userId trennt die Entwürfe mehrerer Konten auf demselben Browser.
export function bookDraftKey(userId?: number, bookId?: number): string {
  return `mr-book-draft:u${userId ?? "anon"}:book:${bookId ?? "new"}`;
}
