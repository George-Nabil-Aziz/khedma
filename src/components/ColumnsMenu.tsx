import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { useI18n } from '../lib/i18n'
import type { Column, useColumnPrefs } from '../lib/columns'
import { GripIcon, LockIcon, XIcon } from './Icons'

type Prefs = ReturnType<typeof useColumnPrefs>

/** Show / hide columns, and drag them into any order. The name column is fixed first. */
export function ColumnsMenu({ prefs, onClose }: { prefs: Prefs; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute inset-e-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">{t('showHideColumns')}</span>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t('close')}
          >
            <XIcon />
          </button>
        </div>
        <p className="mb-2 px-1 text-xs text-slate-400">{t('dragToReorder')}</p>

        <div className="max-h-[60vh] overflow-y-auto">
          <ColumnsList ordered={prefs.ordered} onToggle={prefs.toggle} onReorder={prefs.reorder} />
        </div>

        <button
          onClick={prefs.reset}
          disabled={prefs.isDefault}
          className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {t('resetDefault')}
        </button>
      </div>
    </>
  )
}

/** The name (fixed first), then every column: drag to reorder, tick to show. */
export function ColumnsList({ ordered, onToggle, onReorder }: { ordered: Prefs['ordered']; onToggle: (id: string) => void; onReorder: (id: string, overId: string) => void }) {
  const { t } = useI18n()
  const sensors = useSensors(
    // A small move before dragging starts, so ticking a checkbox is still a plain click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // On a phone: press and hold briefly, so the list can still be scrolled with a finger.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id))
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400">
        <LockIcon className="size-4" />
        <span className="flex-1 font-semibold text-slate-700 dark:text-slate-200">{t('name')}</span>
        <span className="text-xs">{t('alwaysShown')}</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
        <SortableContext items={ordered.map(o => o.column.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {ordered.map(({ column, visible }) => (
              <SortableRow key={column.id} column={column} visible={visible} onToggle={() => onToggle(column.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableRow({ column, visible, onToggle }: { column: Column; visible: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: column.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-lg px-1 py-1 ${
        isDragging ? 'relative z-10 bg-white shadow-lg ring-2 ring-indigo-500/40 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
      }`}
    >
      {/* only the handle starts a drag, so the checkbox and label stay easy to tap */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`${t('dragToReorder')}: ${column.label}`}
        className={`grid size-7 shrink-0 touch-none place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <GripIcon />
      </button>
      <label className="flex flex-1 items-center gap-2 py-0.5 text-sm">
        <input type="checkbox" checked={visible} onChange={onToggle} className="size-4 accent-indigo-600" />
        <span className={visible ? '' : 'text-slate-400'}>{column.label}</span>
      </label>
    </div>
  )
}
