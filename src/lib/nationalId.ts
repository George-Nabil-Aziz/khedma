// Egyptian national ID, split by meaning: century · birth date (YYMMDD) · governorate · serial · check digit.
const GROUPS = [1, 6, 2, 4, 1]

/** Digits only, at most 14 — what is stored in the database. */
export const nationalIdDigits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '').slice(0, 14)

/** "31411220123456" → "3-141122-01-2345-6" (works on partial input while typing). */
export function formatNationalId(v: string | null | undefined): string {
  const d = nationalIdDigits(v)
  const parts: string[] = []
  let i = 0
  for (const n of GROUPS) {
    if (i >= d.length) break
    parts.push(d.slice(i, i + n))
    i += n
  }
  return parts.join('-')
}
