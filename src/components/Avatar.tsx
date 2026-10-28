import { useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { initials, photoToThumbnail } from '../lib/image'
import { CameraIcon, TrashIcon } from './Icons'

/** Round photo, or the person's initials when there is none. */
export function Avatar({ photo, name, className = 'size-8 text-xs' }: { photo: string | null | undefined; name: string | null | undefined; className?: string }) {
  if (photo) return <img src={photo} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
  return (
    <span
      aria-hidden
      className={`${className} grid shrink-0 place-items-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200`}
    >
      {initials(name)}
    </span>
  )
}

/** Big avatar with "change" and "remove" — picks from the gallery or the camera on a phone. */
export function PhotoPicker({ photo, name, onChange }: { photo: string | null; name: string; onChange: (photo: string | null) => void }) {
  const { t } = useI18n()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    setError('')
    try {
      onChange(await photoToThumbnail(f))
    } catch {
      setError(t('photoFailed'))
    }
    setBusy(false)
    if (file.current) file.current.value = '' // allow picking the same file again
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => file.current?.click()}
        disabled={busy}
        aria-label={photo ? t('changePhoto') : t('addPhoto')}
        className="group relative rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30"
      >
        <Avatar photo={photo} name={name} className="size-20 text-2xl" />
        <span className="absolute -bottom-1 -inset-e-1 grid size-8 place-items-center rounded-full border-2 border-white bg-indigo-600 text-white shadow group-hover:bg-indigo-700 dark:border-slate-900">
          <CameraIcon className="size-4" />
        </span>
      </button>
      <div className="space-y-1 text-sm">
        <button type="button" onClick={() => file.current?.click()} disabled={busy} className="block font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
          {busy ? t('loading') : photo ? t('changePhoto') : t('addPhoto')}
        </button>
        {photo && (
          <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-slate-500 hover:text-red-600">
            <TrashIcon className="size-3.5" />
            {t('removePhoto')}
          </button>
        )}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
    </div>
  )
}
