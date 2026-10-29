import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../lib/i18n'
import { AlertIcon } from './Icons'

/*
 * The app's own "Are you sure?" box, in place of the browser's grey window.confirm().
 *   if (await confirmDialog({ message, confirmLabel, danger: true })) { … }
 * <ConfirmHost /> is mounted once in main.tsx and shows whichever question is open.
 */

type Request = {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
  /** A list to look over before confirming, e.g. the children that will be deleted. */
  details?: string[]
  /** For the most destructive actions: the confirm button unlocks only after this is typed. */
  requireText?: string
  resolve: (ok: boolean) => void
}

let current: Request | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function confirmDialog(options: Omit<Request, 'resolve'>): Promise<boolean> {
  current?.resolve(false) // a new question replaces an unanswered one
  return new Promise(resolve => {
    current = { ...options, resolve }
    emit()
  })
}

/**
 * Names in a message are written between "…" (e.g. فصل "أبو سيفين"); they are shown bold, quotes
 * kept, so it is plain which part is the name.
 */
function Emphasized({ text }: { text: string }) {
  return text.split(/("[^"]+")/).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-bold text-slate-900 dark:text-white">
        {part}
      </strong>
    ) : (
      part
    ),
  )
}

function answer(ok: boolean) {
  current?.resolve(ok)
  current = null
  emit()
}

export function ConfirmHost() {
  const { t } = useI18n()
  const req = useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!req) return
    setTyped('')
    // Start on "Cancel" so a stray Enter never confirms something destructive.
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && answer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [req])

  if (!req) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => answer(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="relative w-full max-w-sm animate-[confirm-in_.15s_ease-out] space-y-4 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              req.danger ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
            }`}
          >
            <AlertIcon className="size-5" />
          </span>
          <div className="space-y-1">
            <h2 id="confirm-title" className="font-bold">
              {req.title ?? t('areYouSure')}
            </h2>
            <p id="confirm-message" className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <Emphasized text={req.message} />
            </p>
          </div>
        </div>
        {req.details && req.details.length > 0 && (
          <ul className="max-h-48 list-inside list-disc space-y-0.5 overflow-y-auto rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {req.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
        {req.requireText && (
          <label className="flex flex-col gap-2 text-sm">
            <span>
              {t('typeToConfirm')} <strong className="select-all">{req.requireText}</strong>
            </span>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={() => answer(false)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => answer(true)}
            disabled={!!req.requireText && typed.trim() !== req.requireText.trim()}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${
              req.danger ? 'bg-red-600 hover:bg-red-700 disabled:opacity-40' : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40'
            }`}
          >
            {req.confirmLabel ?? t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
