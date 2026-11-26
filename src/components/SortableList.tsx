import type { ReactNode } from 'react'
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

/** What a row spreads onto the element that grabs the drag (the whole row, or just a header). */
export type DragHandle = Record<string, unknown>

/**
 * A drag-to-reorder list with the same behaviour as ReorderList (children): the mouse drags at
 * once, a finger after pressing and holding a moment (anything earlier is a scroll), and the keyboard
 * works. Generic: `renderItem` draws a row and decides where the handle goes. Nothing is saved here —
 * `onChange` gets the new order and the caller decides when to save.
 */
export function SortableList<T extends { id: string }>({
  items,
  onChange,
  renderItem,
  className = 'space-y-1.5',
}: {
  items: T[]
  onChange: (items: T[]) => void
  renderItem: (item: T, index: number, handle: DragHandle, dragging: boolean) => ReactNode
  className?: string
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = items.map(i => i.id)
    onChange(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, i) => (
            <Row key={item.id} item={item} index={i} renderItem={renderItem} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Row<T extends { id: string }>({ item, index, renderItem }: { item: T; index: number; renderItem: (item: T, index: number, handle: DragHandle, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'relative z-10' : ''}>
      {renderItem(item, index, { ...attributes, ...listeners }, isDragging)}
    </li>
  )
}
