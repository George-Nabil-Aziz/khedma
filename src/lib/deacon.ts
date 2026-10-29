// شماس is kept in the plain `deacon` text column as a mark plus an optional note:
// "✅", "✅ أغنسطس", "⛔", "⛔ لسه صغير". No schema change, and sync / audit / conflicts treat it as
// any other text. Text written before the marks existed: "لا"/"no" means no, anything else is
// the rank (e.g. "أغنسطس"), so yes.

export const YES = '✅'
export const NO = '⛔'

export type Deacon = { is: boolean | null; note: string }

// The note is not trimmed here — the form re-parses on every key, and trimming would eat the space
// between two words while typing. Saving the child trims the whole value.
export function parseDeacon(value: string | null | undefined): Deacon {
  const v = (value ?? '').trimStart()
  const after = (mark: string) => v.slice(mark.length).replace(/^ /, '')
  if (v.startsWith(YES)) return { is: true, note: after(YES) }
  if (v.startsWith(NO)) return { is: false, note: after(NO) }
  if (!v.trim()) return { is: null, note: '' }
  if (/^(لا|no)$/i.test(v.trim())) return { is: false, note: '' }
  return { is: true, note: v }
}

export function formatDeacon({ is, note }: Deacon): string {
  if (is === null) return note
  const mark = is ? YES : NO
  return note ? `${mark} ${note}` : mark
}
