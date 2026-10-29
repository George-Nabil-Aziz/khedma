import type { MouseEvent } from 'react'

/**
 * Opens the calendar (نتيجة) / clock of a date or time box on a tap anywhere in it, not only on
 * its small icon. Any other element is left alone, so it can go on every field of a form.
 */
export function openPicker(e: MouseEvent<HTMLElement>) {
  const input = e.currentTarget
  if (!(input instanceof HTMLInputElement) || (input.type !== 'date' && input.type !== 'time')) return
  try {
    input.showPicker()
  } catch {
    /* older browsers: the default behaviour still works */
  }
}
