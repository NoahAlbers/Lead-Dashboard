"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCcw, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_KEY = "dashboard-widget-order";

interface LayoutItem {
  i: string;
  w: number; // 1 = half, 2 = full width
}

interface DashboardGridProps {
  children: React.ReactNode[];
  widgetKeys: string[];
  defaultLayout: LayoutItem[];
}

function SortableWidget({ id, span, children }: { id: string; span: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${span === 2 ? "lg:col-span-2" : ""}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function DashboardGrid({ children, widgetKeys, defaultLayout }: DashboardGridProps) {
  const [order, setOrder] = useState<string[]>(widgetKeys);
  const [mounted, setMounted] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const layoutMap = Object.fromEntries(defaultLayout.map((l) => [l.i, l]));

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === widgetKeys.length) {
          setOrder(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as string);
        const newIdx = prev.indexOf(over.id as string);
        const next = arrayMove(prev, oldIdx, newIdx);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }

  function resetLayout() {
    localStorage.removeItem(STORAGE_KEY);
    setOrder(widgetKeys);
  }

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {children}
      </div>
    );
  }

  const childMap = Object.fromEntries(widgetKeys.map((k, i) => [k, children[i]]));

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Layout
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {order.map((key) => (
              <SortableWidget key={key} id={key} span={layoutMap[key]?.w ?? 1}>
                {childMap[key]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
