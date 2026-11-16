// Reine Funktionen für ISBN-Prüfung und Namensabgleich (ISBN-Lookup).

// Entfernt Bindestriche und Leerzeichen; ein "x" als Prüfziffer wird groß.
export function normalizeIsbn(input: string | null | undefined): string {
  return (input ?? "").replace(/[-\s]/g, "").toUpperCase();
}

// Formale Prüfung: ISBN-10 oder ISBN-13 mit korrekter Prüfziffer.
export function isValidIsbn(input: string | null | undefined): boolean {
  const s = normalizeIsbn(input);
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const d = s[i] === "X" ? 10 : Number(s[i]);
      sum += d * (10 - i);
    }
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(s)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0;
  }
  return false;
}

// Vergleichsform für Namen: ohne Groß-/Kleinschreibung, Akzente und
// Mehrfach-Leerzeichen.
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Heuristik: letztes Wort = Nachname, der Rest = Vorname ("Voltaire" → nur Nachname).
export function splitAuthorName(full: string): { firstName: string; lastName: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  const lastName = words.pop() ?? "";
  return { firstName: words.join(" "), lastName };
}

export function findAuthorByName<T extends { firstName: string; lastName: string }>(
  authors: T[],
  fullName: string
): T | undefined {
  const target = normalizeName(fullName);
  if (!target) return undefined;
  return authors.find((a) => normalizeName(`${a.firstName} ${a.lastName}`) === target);
}

export function findPublisherByName<T extends { name: string }>(
  publishers: T[],
  name: string
): T | undefined {
  const target = normalizeName(name);
  if (!target) return undefined;
  return publishers.find((p) => normalizeName(p.name) === target);
}
