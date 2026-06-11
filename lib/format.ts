import { DatePrecision } from "./api";

// Formatiert ein Lesedatum entsprechend seiner Genauigkeit:
// YEAR → "2024", MONTH → "Dez. 2024", DAY → "25.12.2024"
export function formatReadingDate(
  iso: string | null,
  precision: DatePrecision | null
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  switch (precision ?? "DAY") {
    case "YEAR":
      return String(date.getFullYear());
    case "MONTH":
      return date.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
    default:
      return date.toLocaleDateString("de-DE");
  }
}
