// التصدير: the two sheets (كشف الأولاد, كشف المتابعة) as one neutral model, which the Excel and
// the PDF writers both draw. The sheets are always in Arabic, like the paper ones they replace.
import type { ClassInfo, Owner, SheetInfo } from './supabase'
import { classRows, dayMark, getState, isChecked, visitOf, type ViewRow } from './store'
import { parseDeacon, YES, NO } from './deacon'
import { dmy, iso, serviceDays, serviceYearRange } from './serviceYear'
import { serviceDayOf } from './store'

/** One header cell: spans `span` columns; `down` = also covers the second header row. */
export type HeadCell = { label: string; span: number; down?: boolean; sub?: string }

export type SheetRow =
  | { band: string } // a full-width coloured line, e.g. before the children who left the class
  | { cells: (string | number | null)[]; /** the first `merge` cells cover this row and the next */ merge?: number; shade?: boolean }

export type Sheet = {
  kind: 'children' | 'attendance'
  header: Required<SheetInfo> & { year: string }
  /** Width of each column, in Excel characters (the PDF uses them as proportions). */
  widths: number[]
  /** Widths for the PDF when its wider font needs other proportions than Excel. */
  pdfWidths?: number[]
  head1: HeadCell[]
  /** The second header row: one label per column not covered by a `down` cell of head1. */
  head2: { label: string; sub?: string }[]
  rows: SheetRow[]
  /** Columns whose text starts at the side instead of the middle (names, notes). */
  alignStart: number[]
  /** A file name without extension. */
  fileName: string
}

export const SHEET_LABELS: { key: keyof SheetInfo | 'year'; label: string }[] = [
  { key: 'servants', label: 'الخــادم :' },
  { key: 'year', label: 'خدمة عــام :' },
  { key: 'grade', label: 'السنه الدراسية :' },
  { key: 'head', label: 'أمين الأســرة :' },
  { key: 'area', label: 'منطقة الخدمـة :' },
  { key: 'assistant', label: 'الأمين المساعد :' },
]

export function sheetHeader(c: ClassInfo, info: SheetInfo, servants: string): Sheet['header'] {
  return {
    title: info.title?.trim() || c.name,
    servants: info.servants?.trim() || servants,
    grade: info.grade?.trim() ?? '',
    head: info.head?.trim() ?? '',
    assistant: info.assistant?.trim() ?? '',
    area: info.area?.trim() ?? '',
    year: c.service_year,
  }
}

/** The class's own order (ترتيبي, then by name), with those who left the class last. */
function ordered(classId: string): { inClass: ViewRow[]; left: ViewRow[] } {
  const rows = [...classRows(getState(), classId)].sort(
    (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.full_name.localeCompare(b.full_name, 'ar'),
  )
  return { inClass: rows.filter(r => !r.moved_out_on), left: rows.filter(r => r.moved_out_on) }
}

const LEFT_BAND = 'اتنقلوا من الفصل'
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim()

// ---- كشف الأولاد ------------------------------------------------------------

const phonesOf = (r: ViewRow, owner: Owner) =>
  r.phones
    .filter(p => p.owner === owner && p.number.trim())
    .map(p => p.number.trim())
    .join(' / ')

function deaconText(v: string | null) {
  const d = parseDeacon(v)
  if (d.is === null) return d.note
  return [d.is ? YES : NO, d.note.trim()].filter(Boolean).join(' ')
}

export function childrenSheet(c: ClassInfo, header: Sheet['header']): Sheet {
  const { inClass, left } = ordered(c.id)
  const row = (r: ViewRow, n: number): SheetRow => ({
    cells: [
      n,
      r.full_name,
      r.house_number,
      r.street,
      r.branch_of_street,
      r.landmark,
      r.floor,
      r.side,
      r.apartment,
      r.birth_date ? dmy(r.birth_date) : null,
      phonesOf(r, 'mother'),
      phonesOf(r, 'father'),
      phonesOf(r, 'child'),
      deaconText(r.deacon),
      r.notes,
      r.national_id,
    ],
  })
  const rows: SheetRow[] = [{ band: '' }, ...inClass.map((r, i) => row(r, i + 1))]
  if (left.length) rows.push({ band: LEFT_BAND }, ...left.map((r, i) => row(r, inClass.length + i + 1)))
  return {
    kind: 'children',
    header,
    // the same widths as the paper sheet
    widths: [4, 21, 8, 23.86, 19.43, 20.71, 6.71, 7.29, 5.86, 11.29, 14, 16.71, 20, 16.29, 17.57, 35.29],
    // Cairo is wider than Sakkal Majalla: numbers and dates get room to stay on one line
    pdfWidths: [3.5, 18, 6, 15, 13, 12, 5, 5, 5, 10, 13, 13, 12, 12.5, 16, 14],
    head1: [
      { label: 'م', span: 1, down: true },
      { label: 'إسم الطفل (ثلاثي على الأقل)', span: 1, down: true },
      { label: 'العنوان بالتفصيل', span: 7 },
      { label: 'تاريخ الميلاد', span: 1, down: true },
      { label: 'رقم التليفون (الأرضي / المحمول)', span: 3 },
      { label: 'شماس', span: 1, down: true },
      { label: 'ملاحظات', span: 1, down: true },
      { label: 'الرقم القومي', span: 1, down: true },
    ],
    head2: ['رقم المنزل', 'إسم الشارع', 'متفرع من شارع', 'علامة مميزة', 'الدور', 'ي/ش/ وسط', 'رقم الشقة', 'موبايل ماما', 'موبايل بابا', 'موبايل الولد'].map(label => ({ label })),
    rows,
    alignStart: [1, 3, 4, 5, 14],
    fileName: safe(`كشف الأولاد - ${c.name} - ${c.service_year}`),
  }
}

// ---- كشف المتابعة -----------------------------------------------------------

/** The months of a class's service year, as "yyyy-mm", for the period picker. */
export function classMonths(c: ClassInfo): { value: string; label: string }[] {
  const days = classDays(c, null)
  const fmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })
  const out = new Map<string, string>()
  for (const d of days) out.set(iso(d).slice(0, 7), fmt.format(d))
  return [...out].map(([value, label]) => ({ value, label }))
}

/** The class's service days in its service year — only those of `month` ("yyyy-mm") when given. */
function classDays(c: ClassInfo, month: string | null): Date[] {
  const { start, end } = serviceYearRange(c.service_year)
  const days = serviceDays(start, end, serviceDayOf(getState().classes, c.id))
  return month ? days.filter(d => iso(d).startsWith(month)) : days
}

const VISIT_SIGN = { phone: '📞', home: '🏠', done: '✓' } as const

export function attendanceSheet(c: ClassInfo, header: Sheet['header'], month: string | null): Sheet {
  const s = getState()
  const days = classDays(c, month)
  const dates = days.map(iso)
  const { inClass, left } = ordered(c.id)

  const pair = (r: ViewRow, n: number): SheetRow[] => {
    const att = dates.map(d => (isChecked(s, r.client_id, d, 'attendance') ? YES : null))
    const visits = dates.map(d => {
      const v = visitOf(s, r.client_id, d)
      return v ? VISIT_SIGN[v] : null
    })
    return [
      { cells: [n, r.full_name, 'الحضور', ...att, att.filter(Boolean).length], merge: 2 },
      { cells: [null, null, 'الافتقاد', ...visits, visits.filter(Boolean).length], shade: true },
    ]
  }

  // months as the first header row, the day (with ✝ تناول / ⚽ نادي) under them
  const fmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })
  const months: HeadCell[] = []
  for (const d of days) {
    const label = fmt.format(d)
    const last = months[months.length - 1]
    if (last?.label === label) last.span++
    else months.push({ label, span: 1 })
  }
  const head2 = days.map(d => {
    const date = iso(d)
    const marks = [dayMark(s, c.id, date, 'communion') && '✝', dayMark(s, c.id, date, 'club') && '⚽'].filter(Boolean).join(' ')
    return { label: String(d.getDate()), sub: marks || undefined }
  })

  const rows: SheetRow[] = [{ band: '' }]
  inClass.forEach((r, i) => rows.push(...pair(r, i + 1)))
  if (left.length) {
    rows.push({ band: LEFT_BAND })
    left.forEach((r, i) => rows.push(...pair(r, inClass.length + i + 1)))
  }

  const period = month ? (months[0]?.label ?? month) : c.service_year
  return {
    kind: 'attendance',
    header,
    widths: [4, 24, 9, ...days.map(() => 5), 6],
    head1: [
      { label: 'م', span: 1, down: true },
      { label: 'إسم الطفل', span: 1, down: true },
      { label: 'البيان', span: 1, down: true },
      ...months,
      { label: 'المجموع', span: 1, down: true },
    ],
    head2,
    rows,
    alignStart: [1],
    fileName: safe(`كشف المتابعة - ${c.name} - ${period}`),
  }
}

