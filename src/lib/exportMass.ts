// القداس → Excel: the schedule of one mass drawn like the owner's sheet (right to left; black head;
// coloured group rows; the servant cell tinted with its class colour), plus a second sheet «العدد».
import ExcelJS from 'exceljs'
import { download } from './exportFile'
import { classColor, massCounts, type MassAssignment, type MassChild, type MassClass, type MassGroup } from './mass'

const FONT = 'Arial'
const thin = { style: 'thin' as const, color: { argb: 'FF000000' } }
const box = { top: thin, left: thin, bottom: thin, right: thin }
const solid = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` }, bgColor: { argb: `FF${hex}` } })

/** The fill of a group's title row. */
const GROUP_FILL: Record<string, { hex: string; bold?: boolean }> = {
  hold_lamb: { hex: 'E49EDD' },
  hold_readers: { hex: 'E49EDD' },
  readings: { hex: 'FF9900' },
  incense: { hex: '6D9EEB' },
  responses_1: { hex: 'FFFF00', bold: true },
  responses_2: { hex: 'FFFF00', bold: true },
  responses_3: { hex: 'FFFF00', bold: true },
  responses_4: { hex: 'FFFF00', bold: true },
}

export type MassExport = {
  /** The date as shown, for the file name: "04-12-2026". */
  dateText: string
  groups: MassGroup[]
  rows: Record<string, MassAssignment>
  classes: MassClass[]
  children: MassChild[]
  /** Headings (the app's own words). */
  labels: { servant: string; served: string; service: string; counts: string; childrenServing: string; count: string }
}

function style(cell: ExcelJS.Cell, opts: { bold?: boolean; fill?: string; color?: string; center?: boolean } = {}) {
  cell.font = { name: FONT, size: 14, bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined }
  cell.alignment = { vertical: 'middle', horizontal: opts.center ? 'center' : 'right', wrapText: true, readingOrder: 'rtl' }
  cell.border = box
  if (opts.fill) cell.fill = solid(opts.fill)
}

export async function exportMass(d: MassExport) {
  const wb = new ExcelJS.Workbook()

  // ---- the schedule -------------------------------------------------------------------------
  const ws = wb.addWorksheet('القداس', { views: [{ rightToLeft: true }] })
  ws.columns = [{ width: 30 }, { width: 25 }, { width: 30 }] // A is the right-most column: الخادم
  const head = ws.addRow([d.labels.servant, d.labels.served, d.labels.service])
  head.height = 26
  head.eachCell(c => style(c, { bold: true, fill: '000000', color: 'FFFFFFFF', center: true }))

  for (const g of d.groups) {
    const fill = GROUP_FILL[g.key] ?? { hex: 'FFFF00', bold: true }
    const title = ws.addRow([g.title])
    title.height = 26
    ws.mergeCells(title.number, 1, title.number, 3)
    for (let col = 1; col <= 3; col++) style(title.getCell(col), { bold: true, fill: fill.hex, center: true })

    for (const it of g.items) {
      for (const slot of it.double ? [1, 2] : [1]) {
        const a = d.rows[`${it.key}#${slot}`]
        const cls = d.classes.find(c => c.id === a?.class_id)
        const child = d.children.find(c => c.id === a?.child_id)
        const service = it.double ? `${it.label} (${slot})${it.slotLabels?.[slot - 1] ? ` ${it.slotLabels[slot - 1]}` : ''}` : it.label
        const r = ws.addRow([cls?.name ?? '', child?.name ?? '', service])
        r.height = 26
        style(r.getCell(1), { fill: classColor(d.classes, cls?.id)?.hex })
        style(r.getCell(2))
        style(r.getCell(3))
      }
    }
  }

  // ---- the counts ---------------------------------------------------------------------------
  const counts = massCounts(d.rows, d.children, d.classes)
  const cs = wb.addWorksheet(d.labels.counts, { views: [{ rightToLeft: true }] })
  cs.columns = [{ width: 8 }, { width: 28 }, { width: 34 }, { width: 10 }]
  const total = cs.addRow([`${d.labels.childrenServing}: ${counts.length}`])
  total.height = 26
  cs.mergeCells(total.number, 1, total.number, 4)
  for (let col = 1; col <= 4; col++) style(total.getCell(col), { bold: true, center: true })
  const ch = cs.addRow(['#', d.labels.served, d.labels.servant, d.labels.count])
  ch.height = 26
  ch.eachCell(c => style(c, { bold: true, fill: '000000', color: 'FFFFFFFF', center: true }))
  counts.forEach((x, i) => {
    const r = cs.addRow([i + 1, x.child.name, x.cls?.name ?? '', x.count])
    r.height = 26
    style(r.getCell(1), { center: true })
    style(r.getCell(2))
    style(r.getCell(3), { fill: classColor(d.classes, x.cls?.id)?.hex })
    style(r.getCell(4), { center: true })
  })

  const buffer = await wb.xlsx.writeBuffer()
  await download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `قداس ${d.dateText}.xlsx`)
}
