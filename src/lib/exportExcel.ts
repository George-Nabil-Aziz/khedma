// التصدير → Excel: the sheet drawn like the paper one (this one.xlsx): the church logo, the title,
// the header boxes, grey column heads, the gold band, thin black borders, A4 landscape, right to left.
import ExcelJS from 'exceljs'
import { SHEET_LABELS, type Sheet } from './sheet'
import { download, logoBytes } from './exportFile'

const FONT = 'Sakkal Majalla'
const TITLE_FONT = 'Djadli_Tachkili'
const LABEL_FILL = 'FFDEEAF6' // the header labels
const VALUE_FILL = 'FFF2F2F2' // the header values, and every الافتقاد row
const HEAD_FILL = 'FFD8D8D8' // the column heads
const BAND_FILL = 'FFFFC000' // the gold band
const thin = { style: 'thin' as const, color: { argb: 'FF000000' } }
const box = { top: thin, left: thin, bottom: thin, right: thin }
const solid = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } })

export async function exportExcel(sheet: Sheet) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheet.kind === 'children' ? 'الأولاد' : 'المتابعة', {
    properties: { tabColor: { argb: 'FF92D050' } },
    views: [{ rightToLeft: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0, right: 0, top: 0.16, bottom: 0.2, header: 0, footer: 0 },
    },
  })
  const cols = sheet.widths.length
  ws.columns = sheet.widths.map(width => ({ width }))

  const at = (r: number, c: number) => ws.getCell(r, c)
  const merge = (r1: number, c1: number, r2: number, c2: number) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2)
    return at(r1, c1)
  }

  // ---- the header: logo, title, and the six label / value boxes ----
  const logo = await logoBytes()
  if (logo) {
    const id = wb.addImage({ buffer: logo, extension: 'jpeg' })
    ws.addImage(id, { tl: { col: sheet.kind === 'children' ? 1.03 : 0.05, row: 0 }, ext: { width: 146, height: 80 } })
  }
  ;[21, 18, 21].forEach((h, i) => (ws.getRow(i + 1).height = h))

  const label = (cell: ExcelJS.Cell, text: string) => {
    cell.value = text
    cell.font = { name: FONT, size: 12, bold: true, underline: true }
    cell.fill = solid(LABEL_FILL)
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
  }
  const value = (cell: ExcelJS.Cell, text: string) => {
    cell.value = text
    cell.font = { name: FONT, size: 12, bold: true }
    cell.fill = solid(VALUE_FILL)
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: true }
  }
  const pairs = SHEET_LABELS.map(l => ({ label: l.label, value: sheet.header[l.key] }))

  if (sheet.kind === 'children') {
    // exactly where the paper sheet has them: title C1:G3, then H:I / J:K / L:M / N:O
    const title = merge(1, 3, 3, 7)
    title.value = sheet.header.title
    title.font = { name: TITLE_FONT, size: 22, bold: true }
    title.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    pairs.forEach((p, i) => {
      const r = Math.floor(i / 2) + 1
      const c = i % 2 ? 12 : 8
      label(merge(r, c, r, c + 1), p.label)
      value(merge(r, c + 2, r, c + 3), p.value)
    })
  } else {
    // any number of days: the title across the top, the six boxes split over the columns under it
    ws.getRow(3).height = 21
    ws.getRow(4).height = 21
    const title = merge(1, 3, 2, cols)
    title.value = sheet.header.title
    title.font = { name: TITLE_FONT, size: 22, bold: true }
    title.alignment = { horizontal: 'center', vertical: 'middle' }
    const groups = split(sheet.widths.slice(2), 6).map(([a, b]) => [a + 3, b + 3])
    pairs.forEach((p, i) => {
      const r = Math.floor(i / 3) + 3
      const [lc1, lc2] = groups[(i % 3) * 2]
      const [vc1, vc2] = groups[(i % 3) * 2 + 1]
      label(merge(r, lc1, r, lc2), p.label)
      value(merge(r, vc1, r, vc2), p.value)
    })
  }
  const headerRows = sheet.kind === 'children' ? 3 : 4
  ws.getRow(headerRows + 1).height = 7.5 // the thin gap before the table

  // ---- column heads: two rows ----
  const h1 = headerRows + 2
  const h2 = h1 + 1
  ws.getRow(h1).height = 18
  ws.getRow(h2).height = sheet.kind === 'children' ? 33 : 30
  const head = (cell: ExcelJS.Cell, text: string, size = 12) => {
    cell.value = text
    cell.font = { name: FONT, size, bold: true }
    cell.fill = solid(HEAD_FILL)
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  }
  let c = 1
  const under: number[] = [] // columns the second row labels
  for (const h of sheet.head1) {
    head(merge(h1, c, h.down ? h2 : h1, c + h.span - 1), h.label)
    if (!h.down) for (let k = 0; k < h.span; k++) under.push(c + k)
    c += h.span
  }
  sheet.head2.forEach((h, i) => head(at(h2, under[i]), h.sub ? `${h.label}\n${h.sub}` : h.label, sheet.kind === 'children' ? 12 : 11))
  for (let r = h1; r <= h2; r++) for (let k = 1; k <= cols; k++) at(r, k).border = box

  // ---- the children ----
  let r = h2 + 1
  for (const row of sheet.rows) {
    if ('band' in row) {
      ws.getRow(r).height = row.band ? 24 : 33
      const band = merge(r, 1, r, cols)
      band.value = row.band || null
      band.font = { name: 'Calibri', size: row.band ? 14 : 20, bold: true }
      band.fill = solid(BAND_FILL)
      band.alignment = { horizontal: 'center', vertical: 'middle' }
      for (let k = 1; k <= cols; k++) at(r, k).border = box
    } else {
      ws.getRow(r).height = 21
      row.cells.forEach((v, i) => {
        const cell = at(r, i + 1)
        if (v !== null && v !== '') cell.value = v
        cell.font = { name: FONT, size: 12, bold: true }
        cell.alignment = { horizontal: sheet.alignStart.includes(i) ? 'right' : 'center', vertical: 'middle', wrapText: true }
        cell.numFmt = typeof v === 'number' ? '0' : '@' // phone numbers and national ids stay text, leading 0 and all
        cell.border = box
        if (row.shade) cell.fill = solid(VALUE_FILL)
      })
      if (row.merge) for (let i = 1; i <= row.merge; i++) merge(r, i, r + 1, i)
    }
    r++
  }

  if (sheet.kind === 'attendance') ws.views = [{ rightToLeft: true, state: 'frozen', xSplit: 3, ySplit: h2 }]

  const buffer = await wb.xlsx.writeBuffer()
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${sheet.fileName}.xlsx`)
}

/** Splits columns (by width) into `n` side-by-side groups of about the same width: [first, last] indexes. */
function split(widths: number[], n: number): [number, number][] {
  const total = widths.reduce((a, b) => a + b, 0)
  const out: [number, number][] = []
  let start = 0
  let sum = 0
  for (let g = 0; g < n; g++) {
    const left = n - g - 1 // groups still to come, each needs one column
    let end = start
    sum += widths[end]
    while (end < widths.length - 1 - left && sum < (total * (g + 1)) / n) sum += widths[++end]
    out.push([start, g === n - 1 ? widths.length - 1 : end])
    start = end + 1
  }
  return out
}
