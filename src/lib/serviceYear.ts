// A service year ends on the first Friday AFTER 6 October: 6 Oct and that Friday still belong
// to the old year. So 2026-2027 runs from Sat 10 Oct 2026 to Fri 8 Oct 2027.
// Same rule as khedma.service_year_end() in the database.
// An admin can move that end by up to 3 Fridays either way (الإعدادات); `extraWeeks` holds it.

const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const MAX_EXTRA_WEEKS = 3
let extraWeeks = 0

/** Fridays added to (or, when negative, taken off) the end of every service year. */
export const yearEndWeeks = () => extraWeeks
export function setYearEndWeeks(n: number) {
  extraWeeks = n
}

/** The last day (a Friday) of the service year that ends in `year`. */
export function yearEnd(year: number, weeks = extraWeeks): Date {
  const d = new Date(year, 9, 6)
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7) + weeks * 7)
  return d
}

/** "2026-2027" for the service year `today` is in. */
export function currentServiceYear(today = new Date()): string {
  const y = today.getFullYear()
  const from = iso(today) > iso(yearEnd(y)) ? y : y - 1
  return `${from}-${from + 1}`
}

/** First and last day of a service year such as "2026-2027". */
export function serviceYearRange(label: string): { start: string; end: string } {
  const from = Number(label.slice(0, 4))
  const start = yearEnd(from)
  start.setDate(start.getDate() + 1)
  return { start: iso(start), end: iso(yearEnd(from + 1)) }
}

const FIRST_YEAR = 2001
const YEARS_AHEAD = 20

/**
 * Service years to pick from when creating a class, as the year they END in — picking 2027
 * means "2026-2027". Twenty years ahead, back to 2001, newest first.
 */
export function serviceYearOptions(today = new Date()): { value: string; label: string }[] {
  const end = Number(currentServiceYear(today).slice(5))
  const out: { value: string; label: string }[] = []
  for (let y = end + YEARS_AHEAD; y >= FIRST_YEAR; y--) out.push({ value: `${y - 1}-${y}`, label: String(y) })
  return out
}
