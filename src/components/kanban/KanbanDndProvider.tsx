import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import { KanbanCard } from './KanbanCard';
import type { Task, Subtask } from '@/types';

interface KanbanDndProviderProps {
  children: React.ReactNode;
  items: Array<{ id: string; status: string }>;
  onDrop: (itemId: string, newStatus: string) => Promise<void>;
  tasks?: Task[];
  subtasks?: Subtask[];
}

export function KanbanDndProvider({ children, items, onDrop, tasks = [], subtasks = [] }: KanbanDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const itemId = active.id as string;
    const newStatus = over.id as string;

    await onDrop(itemId, newStatus);
  };

  const activeItem = activeId ? items.find(item => item.id === activeId) : null;
  const task = activeItem ? tasks.find(t => `task-${t.id}` === activeId) : undefined;
  const subtask = activeItem ? subtasks.find(s => `subtask-${s.id}` === activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {activeItem && task ? (
          <KanbanCard task={task} />
        ) : activeItem && subtask ? (
          <KanbanCard subtask={subtask} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
