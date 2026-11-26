// القداس → what leaves the app besides Excel: a picture of the schedule and a WhatsApp text.
import { download } from './exportFile'
import { classColor, type MassAssignment, type MassChild, type MassClass, type MassGroup, type MassItem } from './mass'

/** One mass, ready to be drawn or written. */
export type MassSheetData = {
  /** "04-12-2026" */
  dateText: string
  /** "25 هاتور 1743" */
  copticText: string
  groups: MassGroup[]
  rows: Record<string, MassAssignment>
  classes: MassClass[]
  children: MassChild[]
}

/** The fill of a group's title row (the owner's sheet): shared by Excel and the picture. */
export const GROUP_FILL: Record<string, { hex: string; bold?: boolean }> = {
  hold_lamb: { hex: 'E49EDD' },
  hold_readers: { hex: 'E49EDD' },
  readings: { hex: 'FF9900' },
  incense: { hex: '6D9EEB' },
  responses_1: { hex: 'FFFF00', bold: true },
  responses_2: { hex: 'FFFF00', bold: true },
  responses_3: { hex: 'FFFF00', bold: true },
  responses_4: { hex: 'FFFF00', bold: true },
}
export const groupFill = (key: string) => GROUP_FILL[key] ?? { hex: 'FFFF00', bold: true }

/** The lines of a service: one, or two with their numbers and labels. */
export const slotsOf = (it: MassItem) => (it.double ? [1, 2] : [1])

/** "دورة البولس (1) الصليب", or the plain name. */
export const serviceName = (it: MassItem, slot: number) => (it.double ? `${it.label} (${slot})${it.slotLabels?.[slot - 1] ? ` ${it.slotLabels[slot - 1]}` : ''}` : it.label)

function pick(d: MassSheetData, it: MassItem, slot: number) {
  const a = d.rows[`${it.key}#${slot}`]
  return { cls: d.classes.find(c => c.id === a?.class_id), child: d.children.find(c => c.id === a?.child_id) }
}

// ---- WhatsApp text ----------------------------------------------------------------------------

/** WhatsApp formatting: *bold* titles, "- service: child (class)", «—» for an empty line. */
export function massText(d: MassSheetData): string {
  const out = [`*القداس - ${d.dateText} - ${d.copticText}*`]
  for (const g of d.groups) {
    out.push('', `*${g.title}*`)
    for (const it of g.items) {
      for (const slot of slotsOf(it)) {
        const { cls, child } = pick(d, it, slot)
        const who = child ? `${child.name}${cls ? ` (${cls.name})` : ''}` : cls ? cls.name : '—'
        out.push(`- ${serviceName(it, slot)}: ${who}`)
      }
    }
  }
  return out.join('\n')
}

// ---- picture ----------------------------------------------------------------------------------

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const WIDTH = 760 // wide enough to read on a phone screen once shared, tall as needed

/** A PNG of the schedule, drawn from clean HTML (never the live selects), light colours always. */
export async function massImage(d: MassSheetData, labels: { servant: string; served: string; service: string }) {
  const { default: html2canvas } = await import('html2canvas-pro')
  await document.fonts.ready
  const cell = 'border:1px solid #000;padding:7px 10px;font-size:18px;line-height:1.35;'
  const rowsHtml = d.groups
    .map(g => {
      const f = groupFill(g.key)
      const title = `<tr><td colspan="3" style="${cell}background:#${f.hex};text-align:center;font-weight:700;">${esc(g.title)}</td></tr>`
      const lines = g.items
        .flatMap(it =>
          slotsOf(it).map(slot => {
            const { cls, child } = pick(d, it, slot)
            const tint = classColor(d.classes, cls?.id)?.hex
            return `<tr><td style="${cell}${tint ? `background:#${tint};` : ''}">${esc(cls?.name)}</td><td style="${cell}">${esc(child?.name)}</td><td style="${cell}font-weight:600;">${esc(serviceName(it, slot))}</td></tr>`
          }),
        )
        .join('')
      return title + lines
    })
    .join('')

  const host = document.createElement('div')
  host.setAttribute('dir', 'rtl')
  host.style.cssText = `position:fixed;top:0;left:-20000px;width:${WIDTH}px;background:#fff;color:#000;font-family:"Cairo Variable",sans-serif;padding:16px;box-sizing:border-box;`
  host.innerHTML = `
    <div style="text-align:center;font-size:24px;font-weight:700;margin-bottom:12px;">القداس - ${esc(d.dateText)} - ${esc(d.copticText)}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup><col style="width:36%"><col style="width:28%"><col style="width:36%"></colgroup>
      <thead><tr>${[labels.servant, labels.served, labels.service].map(h => `<td style="${cell}background:#000;color:#fff;font-weight:700;text-align:center;">${esc(h)}</td>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`
  document.body.appendChild(host)
  try {
    const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff', logging: false })
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/png'))
    if (!blob) throw new Error('image')
    await download(blob, `قداس ${d.dateText}.png`)
  } finally {
    host.remove()
  }
}
