import { useSyncExternalStore } from 'react'

/*
 * A small note at the bottom of the screen that goes away by itself, e.g. "copied".
 *   toast('اتنسخ ✓')
 * <ToastHost /> is mounted once in main.tsx.
 */

type Note = { id: number; text: string }

let current: Note | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function toast(text: string, ms = 2000) {
  current = { id: Date.now(), text } // a new note replaces the one showing
  emit()
  clearTimeout(timer)
  timer = setTimeout(() => {
    current = null
    emit()
  }, ms)
}

export function ToastHost() {
  const note = useSyncExternalStore(
    l => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  if (!note) return null
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div key={note.id} className="animate-[toast-in_150ms_ease-out] rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-slate-900">
        {note.text}
      </div>
    </div>
  )
}
