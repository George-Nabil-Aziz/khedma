// التصدير → PDF: the same sheet drawn as HTML (so Arabic is joined and laid out by the browser),
// cut into A4 landscape pages, each page photographed and put in the PDF.
// A wide متابعة (more days than fit) is cut into groups of days, each starting on a new page.
import html2canvas from 'html2canvas-pro'
import { jsPDF } from 'jspdf'
import { SHEET_LABELS, type HeadCell, type Sheet, type SheetRow } from './sheet'
import { download, logoUrl } from './exportFile'

const PAGE_W = 1123 // A4 landscape at 96 dpi
const PAGE_H = 794
const PAD = 24
const FOOTER = 18
const MAX_DAYS = 18 // days that still fit across one page

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export async function exportPdf(sheet: Sheet) {
  await document.fonts.ready
  const host = document.createElement('div')
  host.setAttribute('dir', 'rtl')
  host.style.cssText = `position:fixed;top:0;left:-20000px;width:${PAGE_W}px;font-family:"Cairo Variable",sans-serif;color:#000;`
  document.body.appendChild(host)

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  try {
    const parts = byDays(sheet)
    const pages: { html: string }[] = []
    for (const part of parts) {
      // measure every row at page width, then fill pages
      host.innerHTML = page(part, true, part.rows)
      const header = host.querySelector<HTMLElement>('[data-header]')!.offsetHeight
      const thead = host.querySelector<HTMLElement>('thead')!.offsetHeight
      const heights = [...host.querySelectorAll<HTMLElement>('tbody tr')].map(tr => tr.offsetHeight)
      const units = unitsOf(part.rows, heights)
      const room = (first: boolean) => PAGE_H - 2 * PAD - FOOTER - thead - (first ? header + 8 : 0)
      let chunk: SheetRow[] = []
      let used = 0
      let first = true
      for (const u of units) {
        if (chunk.length && used + u.height > room(first)) {
          pages.push({ html: page(part, first, chunk) })
          chunk = []
          used = 0
          first = false
        }
        chunk.push(...u.rows)
        used += u.height
      }
      if (chunk.length || first) pages.push({ html: page(part, first, chunk) })
    }

    for (let i = 0; i < pages.length; i++) {
      host.innerHTML = pages[i].html.replace('{page}', `${i + 1} / ${pages.length}`)
      const node = host.firstElementChild as HTMLElement
      await Promise.all([...node.querySelectorAll('img')].map(img => (img.complete ? null : new Promise(ok => (img.onload = img.onerror = ok)))))
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', width: PAGE_W, height: PAGE_H, logging: false })
      if (i) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, ph)
    }
  } finally {
    host.remove()
  }
  download(pdf.output('blob'), `${sheet.fileName}.pdf`)
}

/** Rows kept together on one page: a child's الحضور and الافتقاد, a band with the row after it. */
function unitsOf(rows: SheetRow[], heights: number[]) {
  const out: { rows: SheetRow[]; height: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    let n = 1
    if ('cells' in row && row.merge) n = 2
    if ('band' in row && i + 1 < rows.length) n = 1 + ('cells' in rows[i + 1] && (rows[i + 1] as { merge?: number }).merge ? 2 : 1)
    const group = rows.slice(i, i + n)
    out.push({ rows: group, height: heights.slice(i, i + n).reduce((a, b) => a + b, 0) })
    i += n - 1
  }
  return out
}

/** A متابعة with many days, cut into sheets of at most MAX_DAYS days each (same first and last columns). */
function byDays(sheet: Sheet): Sheet[] {
  if (sheet.kind !== 'attendance') return [sheet]
  const days = sheet.head2.length
  if (days <= MAX_DAYS) return [sheet]
  const out: Sheet[] = []
  const groups = Math.ceil(days / MAX_DAYS)
  const size = Math.ceil(days / groups)
  for (let from = 0; from < days; from += size) {
    const to = Math.min(days, from + size)
    const keep = (cells: unknown[]) => [...cells.slice(0, 3), ...cells.slice(3 + from, 3 + to), cells[cells.length - 1]]
    // the months over these days only
    const months: HeadCell[] = []
    let k = 0
    for (const m of sheet.head1.slice(3, -1)) {
      const a = Math.max(k, from)
      const b = Math.min(k + m.span, to)
      if (b > a) months.push({ ...m, span: b - a })
      k += m.span
    }
    out.push({
      ...sheet,
      widths: keep(sheet.widths) as number[],
      head1: [...sheet.head1.slice(0, 3), ...months, sheet.head1[sheet.head1.length - 1]],
      head2: sheet.head2.slice(from, to),
      rows: sheet.rows.map(r => ('band' in r ? r : { ...r, cells: keep(r.cells) as typeof r.cells })),
    })
  }
  return out
}

const border = '1px solid #000'
const cell = (extra = '') => `border:${border};padding:2px 4px;text-align:center;vertical-align:middle;${extra}`

function page(sheet: Sheet, withHeader: boolean, rows: SheetRow[]): string {
  // a column is at least as wide as its longest word or number, so nothing has to be broken or cut
  const small = sheet.kind === 'attendance' ? 11 : 10.5
  const base = sheet.pdfWidths ?? sheet.widths
  const room = PAGE_W - 2 * PAD
  const sum = base.reduce((a, b) => a + b, 0)
  // in pixels: what the longest word needs, and what the column's share of the page gives it;
  // columns with more than they need give some back so the words of the others fit
  const need = base.map((_, i) => longestWord(sheet, i) * small * 0.62 + 10)
  const want = base.map((w, i) => Math.max((w / sum) * room, need[i]))
  const slack = want.reduce((a, w, i) => a + w - need[i], 0)
  const minimum = need.reduce((a, b) => a + b, 0)
  const k = slack > 0 ? Math.max(0, Math.min(1, (room - minimum) / slack)) : 0
  const widths = want.map((w, i) => need[i] + (w - need[i]) * k)
  const total = widths.reduce((a, b) => a + b, 0)
  const cols = widths.map(w => `<col style="width:${((w / total) * 100).toFixed(3)}%">`).join('')

  const head1 = sheet.head1
    .map(h => `<th colspan="${h.span}" rowspan="${h.down ? 2 : 1}" style="${cell(`background:#d8d8d8;font-size:${small}px;font-weight:700;`)}">${esc(h.label)}</th>`)
    .join('')
  const head2 = sheet.head2
    .map(h => `<th style="${cell(`background:#d8d8d8;font-size:${small}px;font-weight:700;line-height:1.2;`)}">${esc(h.label)}${h.sub ? `<div style="font-size:9px">${esc(h.sub)}</div>` : ''}</th>`)
    .join('')

  const body = rows
    .map(row => {
      if ('band' in row)
        return `<tr><td colspan="${sheet.widths.length}" style="${cell(`background:#ffc000;font-weight:700;font-size:13px;height:${row.band ? 22 : 12}px;`)}">${esc(row.band)}</td></tr>`
      const tds = row.cells
        .map((v, i) => {
          if (v === null && !row.merge && i < 2 && sheet.kind === 'attendance') return '' // covered by the row above
          const span = row.merge && i < row.merge ? ' rowspan="2"' : ''
          const align = sheet.alignStart.includes(i) ? 'text-align:right;' : ''
          const bg = row.shade ? 'background:#f2f2f2;' : ''
          return `<td${span} style="${cell(`${align}${bg}font-size:${small}px;font-weight:600;overflow-wrap:anywhere;`)}">${esc(v)}</td>`
        })
        .join('')
      return `<tr style="height:22px">${tds}</tr>`
    })
    .join('')

  return `<div style="width:${PAGE_W}px;height:${PAGE_H}px;padding:${PAD}px;box-sizing:border-box;background:#fff;position:relative;">
    ${withHeader ? header(sheet) : '<div data-header></div>'}
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup>${cols}</colgroup>
      <thead><tr>${head1}</tr><tr>${head2}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div style="position:absolute;bottom:${PAD - 6}px;left:${PAD}px;font-size:10px;color:#555" dir="ltr">{page}</div>
  </div>`
}

/** The longest word (or number) in a column of the table, in characters. */
function longestWord(sheet: Sheet, i: number) {
  // the column's own head too (the second header row sits over the columns head1 does not cover)
  const under: number[] = []
  let c = 0
  for (const h of sheet.head1) {
    if (!h.down) for (let k = 0; k < h.span; k++) under.push(c + k)
    c += h.span
  }
  const head = under.indexOf(i)
  const own = head >= 0 ? sheet.head2[head].label : (sheet.head1.find((h, j) => h.down && sheet.head1.slice(0, j).reduce((a, x) => a + x.span, 0) === i)?.label ?? '')
  let n = Math.max(0, ...own.split(/\s+/).map(w => w.length))
  for (const row of sheet.rows) if ('cells' in row) for (const w of String(row.cells[i] ?? '').split(/\s+/)) n = Math.max(n, w.length)
  return n
}

function header(sheet: Sheet): string {
  const box = (text: string, bg: string, extra = '') =>
    `<div style="background:${bg};padding:2px 8px;font-size:13px;font-weight:700;overflow-wrap:anywhere;${extra}">${esc(text)}</div>`
  const pairs = SHEET_LABELS.map(l => box(l.label, '#deeaf6', 'text-decoration:underline;') + box(sheet.header[l.key], '#f2f2f2', 'text-align:center;')).join('')
  return `<div data-header style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
    <img src="${logoUrl()}" style="width:146px;height:80px;object-fit:contain;flex:none" />
    <div style="flex:1;text-align:center;font-size:28px;font-weight:800;line-height:1.3">${esc(sheet.header.title)}</div>
    <div style="display:grid;grid-template-columns:auto minmax(120px,190px) auto minmax(120px,190px);gap:3px 6px;flex:none">${pairs}</div>
  </div>`
}
