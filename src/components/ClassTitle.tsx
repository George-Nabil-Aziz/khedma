import { useStore } from '../lib/store'
import { StarIcon } from './Icons'

/** The class on screen, in full — the sidebar picker cuts long names short. */
export function ClassTitle() {
  const { classes, currentClass } = useStore()
  const c = classes.find(x => x.id === currentClass)
  if (!c) return null
  return (
    <h2 className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-xl font-bold">{c.name}</span>
      <span className="flex items-center gap-1.5 text-sm text-slate-500">
        {c.is_default && <StarIcon className="size-4 text-amber-500" />}
        <span dir="ltr">{c.service_year}</span>
      </span>
    </h2>
  )
}
