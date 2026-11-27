// القداس → Excel: the schedule of one mass drawn like the owner's sheet (right to left; black head;
// coloured group rows; the servant cell tinted with its class colour).
import ExcelJS from 'exceljs'
import { download } from './exportFile'
import { classColor, groupFill } from './mass'
import { serviceName, slotsOf, type MassSheetData } from './massShare'

const FONT = 'Arial'
const thin = { style: 'thin' as const, color: { argb: 'FF000000' } }
const box = { top: thin, left: thin, bottom: thin, right: thin }
const solid = (hex: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` }, bgColor: { argb: `FF${hex}` } })

export type MassExport = MassSheetData & {
  /** Headings (the app's own words). */
  labels: { servant: string; served: string; service: string }
}

function style(cell: ExcelJS.Cell, opts: { bold?: boolean; fill?: string; color?: string; center?: boolean } = {}) {
  cell.font = { name: FONT, size: 14, bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined }
  cell.alignment = { vertical: 'middle', horizontal: opts.center ? 'center' : 'right', wrapText: true, readingOrder: 'rtl' }
  cell.border = box
  if (opts.fill) cell.fill = solid(opts.fill)
}

export async function exportMass(d: MassExport) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('القداس', { views: [{ rightToLeft: true }] })
  ws.columns = [{ width: 30 }, { width: 25 }, { width: 30 }] // A is the right-most column: الخادم
  const head = ws.addRow([d.labels.servant, d.labels.served, d.labels.service])
  head.height = 26
  head.eachCell(c => style(c, { bold: true, fill: '000000', color: 'FFFFFFFF', center: true }))

  for (const g of d.groups) {
    const fill = groupFill(g)
    const title = ws.addRow([g.title])
    title.height = 26
    ws.mergeCells(title.number, 1, title.number, 3)
    for (let col = 1; col <= 3; col++) style(title.getCell(col), { bold: true, fill: fill.hex, center: true })

    for (const it of g.items) {
      for (const slot of slotsOf(it)) {
        const a = d.rows[`${it.key}#${slot}`]
        const cls = d.classes.find(c => c.id === a?.class_id)
        const child = d.children.find(c => c.id === a?.child_id)
        const r = ws.addRow([cls?.name ?? '', child?.name ?? '', serviceName(it, slot)])
        r.height = 26
        style(r.getCell(1), { fill: classColor(d.classes, cls?.id)?.hex })
        style(r.getCell(2))
        style(r.getCell(3))
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  await download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `قداس ${d.dateText}.xlsx`)
}
