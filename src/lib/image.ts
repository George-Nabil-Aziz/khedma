/**
 * Shrinks a picked photo to a small square-ish JPEG thumbnail (longest side `max` px)
 * and returns it as a data: URL — about 20–40 KB, small enough to keep in the database row.
 */
export async function photoToThumbnail(file: File, max = 320): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

/** Up to two initials for a placeholder avatar: "مينا جرجس" → "مج". */
export function initials(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => [...w][0] ?? '')
    .join('')
}
