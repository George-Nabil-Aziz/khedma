// What both exports share: the church logo, and handing the finished file to the user.

let logo: Promise<ArrayBuffer | null> | null = null

/** The church logo of the paper sheets (public/sheet-logo.jpg), or null if it can't be loaded. */
export function logoBytes(): Promise<ArrayBuffer | null> {
  logo ??= fetch(`${import.meta.env.BASE_URL}sheet-logo.jpg`)
    .then(r => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null)
  return logo
}

export const logoUrl = () => `${import.meta.env.BASE_URL}sheet-logo.jpg`

/** Saves the file: downloaded on a computer; on a phone the share sheet when it can take files (save / WhatsApp). */
export async function download(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type })
  const phone = matchMedia('(pointer: coarse)').matches
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // closed on purpose
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
