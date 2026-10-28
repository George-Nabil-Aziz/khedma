import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

/**
 * Six boxes, one digit each. Typing a digit moves to the next box, Backspace goes back,
 * and pasting "123456" fills them all. Calls onComplete once all six are filled.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  length = 6,
}: {
  value: string
  onChange: (v: string) => void
  onComplete: (v: string) => void
  disabled?: boolean
  length?: number
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')
  // The code as of the last keystroke. `value` only catches up on the next render, and focus
  // moves before that — reading the stale prop sent focus back to the first box and selected it.
  const latest = useRef(value)
  latest.current = value

  function update(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length)
    latest.current = clean
    onChange(clean)
    if (clean.length === length) onComplete(clean)
    return clean
  }

  function typeAt(i: number, raw: string) {
    const d = raw.replace(/\D/g, '')
    if (!d) return
    // A phone keyboard may drop several digits into one box (autofill) — spread them out.
    const clean = update((latest.current.slice(0, i) + d).slice(0, length))
    boxes.current[Math.min(clean.length, length - 1)]?.focus()
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const at = latest.current[i] ? i : i - 1
      if (at < 0) return
      update(latest.current.slice(0, at))
      boxes.current[at]?.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Boxes always read left-to-right, like the code itself.
      e.preventDefault()
      boxes.current[i + (e.key === 'ArrowRight' ? 1 : -1)]?.focus()
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const clean = update(e.clipboardData.getData('text'))
    boxes.current[Math.min(clean.length, length - 1)]?.focus()
  }

  return (
    <div dir="ltr" className="flex justify-center gap-1.5 sm:gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => {
            boxes.current[i] = el
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          aria-label={`${i + 1} / ${length}`}
          // Always type into the first empty box, so the digits stay in order.
          onFocus={e => {
            const first = Math.min(latest.current.length, length - 1)
            if (i > first) boxes.current[first]?.focus()
            else e.target.select()
          }}
          onChange={e => typeAt(i, e.target.value)}
          onKeyDown={e => onKeyDown(i, e)}
          onPaste={onPaste}
          className={`size-10 rounded-xl border-2 bg-white text-center font-mono text-xl font-bold sm:text-2xl outline-none transition-colors focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 disabled:opacity-50 sm:size-14 dark:bg-slate-800 ${
            d ? 'border-indigo-300 dark:border-indigo-500/50' : 'border-slate-300 dark:border-slate-600'
          }`}
        />
      ))}
    </div>
  )
}
