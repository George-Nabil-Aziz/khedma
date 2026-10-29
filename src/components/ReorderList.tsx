import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { useI18n } from '../lib/i18n'
import { saveOrder, type ViewRow } from '../lib/store'
import { Avatar } from './Avatar'
import { GripIcon } from './Icons'

/**
 * ترتيبي by hand: drag the children into the order you want. Nothing is saved or synced while
 * dragging — only "Done" saves the new order (in one go); "Cancel" drops it. Children who left
 * the class are a group of their own below, and are dragged only among themselves.
 */
export function ReorderList({ rows, onClose }: { rows: ViewRow[]; onClose: () => void }) {
  const { t } = useI18n()
  const [stayed, setStayed] = useState(() => rows.filter(r => !r.moved_out_on))
  const [left, setLeft] = useState(() => rows.filter(r => r.moved_out_on))
  const changed = [...stayed, ...left].some((r, i) => r !== rows[i])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
        <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
          {t('cancel')}
        </button>
        <button
          onClick={() => {
            if (changed) saveOrder([...stayed, ...left].map(r => r.client_id))
            onClose()
          }}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {t('reorderDone')}
        </button>
      </div>

      <Group rows={stayed} onChange={setStayed} from={1} />
      {left.length > 0 && (
        <>
          <div className="border-t-2 border-slate-300 px-1 pt-2 text-xs font-bold text-slate-500 dark:border-slate-600">
            {t('movedOut')} ({left.length})
          </div>
          <Group rows={left} onChange={setLeft} from={stayed.length + 1} dim />
        </>
      )}
    </div>
  )
}

function Group({ rows, onChange, from, dim }: { rows: ViewRow[]; onChange: (rows: ViewRow[]) => void; from: number; dim?: boolean }) {
  const sensors = useSensors(
    // the mouse drags straight away; a finger only after pressing and holding a moment —
    // any earlier movement is a scroll. (A pointer sensor would grab touches too.)
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = rows.map(r => r.client_id)
    onChange(arrayMove(rows, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map(r => r.client_id)} strategy={verticalListSortingStrategy}>
        <ul className={`space-y-1.5 ${dim ? 'opacity-60' : ''}`}>
          {rows.map((r, i) => (
            <Item key={r.client_id} row={r} n={from + i} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Item({ row, n }: { row: ViewRow; n: number }) {
  const { t } = useI18n()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.client_id })
  return (
    // the whole row is the handle: grab the child anywhere and drag
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${t('dragToReorder')}: ${row.full_name}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex touch-manipulation select-none items-center [-webkit-touch-callout:none] gap-3 rounded-xl border bg-white px-3 py-2 dark:bg-slate-900 ${
        isDragging ? 'relative z-10 cursor-grabbing border-indigo-400 shadow-lg ring-2 ring-indigo-500/30' : 'cursor-grab border-slate-200 hover:border-indigo-300 dark:border-slate-800'
      }`}
    >
      <GripIcon className="size-4 shrink-0 text-slate-400" />
      <span className="w-6 shrink-0 text-center text-sm text-slate-400">{n}</span>
      <Avatar photo={row.photo} name={row.full_name} />
      <span className="truncate font-semibold">{row.full_name}</span>
    </li>
  )
}
