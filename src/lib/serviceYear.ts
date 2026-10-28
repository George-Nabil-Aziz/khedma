// The service year starts on 6 October: from 6 Oct 2026 to 5 Oct 2027 it is "2026-2027".
const START_MONTH = 9 // October (0-based)
const START_DAY = 6

export function serviceYear(today = new Date()) {
  const y = today.getFullYear()
  const started = today.getMonth() > START_MONTH || (today.getMonth() === START_MONTH && today.getDate() >= START_DAY)
  const from = started ? y : y - 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    label: `${from}-${from + 1}`,
    start: `${from}-${pad(START_MONTH + 1)}-${pad(START_DAY)}`,
    end: `${from + 1}-${pad(START_MONTH + 1)}-${pad(START_DAY)}`,
  }
}
