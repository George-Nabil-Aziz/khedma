import { useEffect, useRef, useSyncExternalStore } from 'react'
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

  useEffect(() => {
    if (!req) return
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
              {req.message}
            </p>
          </div>
        </div>
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
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${
              req.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {req.confirmLabel ?? t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
