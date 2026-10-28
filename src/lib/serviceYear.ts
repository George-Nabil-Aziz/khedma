// A service year ends on the first Friday AFTER 6 October: 6 Oct and that Friday still belong
// to the old year. So 2026-2027 runs from Sat 10 Oct 2026 to Fri 8 Oct 2027.
// Same rule as khedma_2027.service_year_end() in the database.

const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The last day (a Friday) of the service year that ends in `year`. */
function yearEnd(year: number): Date {
  const d = new Date(year, 9, 6)
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7))
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

/** Years to offer when creating a class: last, this and next. */
export function nearbyServiceYears(today = new Date()): string[] {
  const from = Number(currentServiceYear(today).slice(0, 4))
  return [from + 1, from, from - 1].map(y => `${y}-${y + 1}`)
}
