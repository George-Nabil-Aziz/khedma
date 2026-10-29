import { useI18n } from '../lib/i18n'

/** Shown instead of a table while its data is still loading — never an empty table first. */
export function Loading() {
  const { t } = useI18n()
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-16 text-slate-500 dark:border-slate-800 dark:bg-slate-900">
      <span className="size-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-500/20 dark:border-t-indigo-400" />
      <span className="text-sm font-semibold">{t('loading')}</span>
    </div>
  )
}
