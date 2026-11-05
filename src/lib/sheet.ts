// التصدير: the two sheets (كشف الأولاد, كشف المتابعة) as one neutral model, which the Excel and
// the PDF writers both draw. The sheets are always in Arabic, like the paper ones they replace.
import type { ClassInfo, Owner, SheetInfo } from './supabase'
import { classFields, classRows, dayMark, flatGet, getState, isChecked, visitOf, X, type ViewRow } from './store'
import { ageOf, CATEGORIES, otherAddressText } from './columns'
import { arabic } from './i18n'
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

const LEFT_BAND = 'خرجوا من الفصل'
/** Who the file is from: the class's servants, or — offline, when they could not be loaded — the class name. */
const who = (c: ClassInfo, header: Sheet['header']) => header.servants || c.name
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim()

// ---- كشف الأولاد ------------------------------------------------------------

/** A child's numbers for one owner (ماما / بابا / الولد). */
const phonesOf = (r: ViewRow, owner: Owner) => r.phones.filter(p => p.owner === owner && p.number.trim()).map(p => p.number.trim())

function deaconText(v: string | null) {
  const d = parseDeacon(v)
  if (d.is === null) return d.note
  return [d.is ? YES : NO, d.note.trim()].filter(Boolean).join(' ')
}

type Cell = string | number | null

/**
 * A column the كشف الأولاد can have. `group`: side-by-side columns of a group share one head over
 * them (العنوان بالتفصيل, رقم التليفون). `owner`: a phone column — it becomes one column per number.
 */
export type ChildColumn = {
  id: string
  label: string
  width: number
  pdf: number
  group?: 'address' | 'phones'
  owner?: Owner
  start?: boolean // text starts at the side (long text) instead of the middle
  value: (r: ViewRow) => Cell
}

const GROUP_LABEL = { address: 'العنوان بالتفصيل', phones: 'رقم التليفون (الأرضي / المحمول)' } as const

/** The paper sheet's columns, in its order — the default. */
const DEFAULT_COLUMNS: ChildColumn[] = [
  { id: 'house_number', label: 'رقم المنزل', width: 8, pdf: 6, group: 'address', value: r => r.house_number },
  { id: 'street', label: 'إسم الشارع', width: 23.86, pdf: 15, group: 'address', start: true, value: r => r.street },
  { id: 'branch_of_street', label: 'متفرع من شارع', width: 19.43, pdf: 13, group: 'address', start: true, value: r => r.branch_of_street },
  { id: 'landmark', label: 'علامة مميزة', width: 20.71, pdf: 12, group: 'address', start: true, value: r => r.landmark },
  { id: 'floor', label: 'الدور', width: 6.71, pdf: 5, group: 'address', value: r => r.floor },
  { id: 'side', label: 'ي/ش/ وسط', width: 7.29, pdf: 5, group: 'address', value: r => r.side },
  { id: 'apartment', label: 'رقم الشقة', width: 5.86, pdf: 5, group: 'address', value: r => r.apartment },
  { id: 'birth_date', label: 'تاريخ الميلاد', width: 11.29, pdf: 10, value: r => (r.birth_date ? dmy(r.birth_date) : null) },
  { id: 'phone:mother', label: 'موبايل ماما', width: 14, pdf: 13, group: 'phones', owner: 'mother', value: () => null },
  { id: 'phone:father', label: 'موبايل بابا', width: 16.71, pdf: 13, group: 'phones', owner: 'father', value: () => null },
  { id: 'phone:child', label: 'موبايل الولد', width: 20, pdf: 12, group: 'phones', owner: 'child', value: () => null },
  { id: 'deacon', label: 'شماس', width: 16.29, pdf: 12.5, value: r => deaconText(r.deacon) },
  { id: 'notes', label: 'ملاحظات', width: 17.57, pdf: 16, start: true, value: r => r.notes },
  { id: 'national_id', label: 'الرقم القومي', width: 35.29, pdf: 14, value: r => r.national_id },
]

/** Columns of the app the paper sheet does not have, plus the class's own columns. */
function moreColumns(classId: string): ChildColumn[] {
  const s = getState()
  const fields = classFields({ ...s, currentClass: classId })
  return [
    { id: 'school', label: arabic('school'), width: 18, pdf: 12, start: true, value: r => r.school },
    { id: 'confession_father', label: arabic('confessionFather'), width: 18, pdf: 12, start: true, value: r => r.confession_father },
    { id: 'age', label: 'السن', width: 6, pdf: 5, value: r => ageOf(r.birth_date) },
    {
      id: 'category',
      label: arabic('category'),
      width: 12,
      pdf: 9,
      value: r => {
        const c = CATEGORIES.find(x => x.value === r.category)
        return c ? arabic(c.key) : null
      },
    },
    { id: 'other_address', label: arabic('otherAddress'), width: 30, pdf: 16, start: true, value: r => (r.other_address ? otherAddressText(r.other_address, arabic, 'ar') || null : null) },
    ...fields.map(
      (f): ChildColumn => ({
        id: X + f.key,
        label: f.label,
        width: f.type === 'boolean' ? 8 : 16,
        pdf: f.type === 'boolean' ? 6 : 12,
        start: f.type === 'text',
        value: r => {
          const v = flatGet(r, X + f.key)
          if (v === null || v === undefined || v === '') return null
          if (f.type === 'boolean') return v ? YES : NO
          if (f.type === 'date') return dmy(String(v))
          return typeof v === 'number' ? v : String(v)
        },
      }),
    ),
  ]
}

/** Every column the كشف الأولاد can have for a class, and which are on by default. */
export function childColumns(classId: string): { all: ChildColumn[]; defaults: string[] } {
  return { all: [...DEFAULT_COLUMNS, ...moreColumns(classId)], defaults: DEFAULT_COLUMNS.map(c => c.id) }
}

/** `picked`: column ids (م and the name are always there), in the order they will show. */
export function childrenSheet(c: ClassInfo, header: Sheet['header'], picked: string[]): Sheet {
  const { inClass, left } = ordered(c.id)
  const everyone = [...inClass, ...left]
  const { all } = childColumns(c.id)
  // the paper sheet's order first, then what was added, in the order of the list
  const chosen = all.filter(col => picked.includes(col.id))

  // one column per number: a second number of ماما gets its own column (موبايل ماما 2), for the whole sheet
  const columns: ChildColumn[] = chosen.flatMap(col => {
    if (!col.owner) return [col]
    const owner = col.owner
    const count = Math.max(1, ...everyone.map(r => phonesOf(r, owner).length))
    return Array.from({ length: count }, (_, k) => ({ ...col, label: k ? `${col.label} ${k + 1}` : col.label, value: (r: ViewRow) => phonesOf(r, owner)[k] ?? null }))
  })

  const row = (r: ViewRow, n: number): SheetRow => ({ cells: [n, r.full_name, ...columns.map(col => col.value(r))] })
  const rows: SheetRow[] = inClass.map((r, i) => row(r, i + 1))
  if (left.length) rows.push({ band: LEFT_BAND }, ...left.map((r, i) => row(r, inClass.length + i + 1)))

  // side-by-side columns of one group under one head; the rest cover both header rows
  const head1: HeadCell[] = [
    { label: 'م', span: 1, down: true },
    { label: 'إسم الطفل (ثلاثي على الأقل)', span: 1, down: true },
  ]
  const head2: { label: string }[] = []
  columns.forEach((col, i) => {
    const prev = columns[i - 1]
    if (col.group && prev?.group === col.group) head1[head1.length - 1].span++
    else head1.push(col.group ? { label: GROUP_LABEL[col.group], span: 1 } : { label: col.label, span: 1, down: true })
    if (col.group) head2.push({ label: col.label })
  })
  // a group with nothing over its second row would leave that row empty: such a sheet has no groups at all
  if (!head2.length) head1.forEach(h => (h.down = true))

  return {
    kind: 'children',
    header,
    // the same widths as the paper sheet
    widths: [4, 21, ...columns.map(col => col.width)],
    // Cairo is wider than Sakkal Majalla: numbers and dates get room to stay on one line
    pdfWidths: [3.5, 18, ...columns.map(col => col.pdf)],
    head1,
    head2,
    rows,
    alignStart: [1, ...columns.flatMap((col, i) => (col.start ? [i + 2] : []))],
    fileName: safe(`كشف الأولاد - ${who(c, header)}`),
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

  const rows: SheetRow[] = []
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
    fileName: safe(`كشف المتابعة - ${who(c, header)} - ${period}`),
  }
}

