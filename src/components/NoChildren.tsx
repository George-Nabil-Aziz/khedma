import { useI18n } from '../lib/i18n'
import { go } from '../lib/router'
import { PlusIcon, UsersIcon } from './Icons'

/** Shown instead of a table when the class on screen has no children yet. */
export function NoChildren() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="grid size-14 place-items-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        <UsersIcon className="size-7" />
      </div>
      <h2 className="text-lg font-bold">{t('noChildrenTitle')}</h2>
      <p className="text-sm text-slate-500">{t('noChildrenHelp')}</p>
      <button
        onClick={() => go('/new')}
        className="mt-1 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
      >
        <PlusIcon className="size-4" />
        {t('addChild')}
      </button>
    </div>
  )
}
