import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Person, Relationship } from "@/lib/family-data";
import { updateChildOrder } from "@/lib/family-api";
import { toast } from "sonner";

interface Row {
  relId: string;
  child: Person;
}

export function ChildOrderEditor({
  persons,
  relationships,
  onSaved,
}: {
  persons: Person[];
  relationships: Relationship[];
  onSaved: () => void;
}) {
  const parents = useMemo(() => {
    const ids = new Set(
      relationships.filter((r) => r.type === "parent").map((r) => r.person1Id),
    );
    return persons.filter((p) => ids.has(p.id));
  }, [persons, relationships]);

  const [parentId, setParentId] = useState<string>("");

  useEffect(() => {
    if (!parentId && parents[0]) setParentId(parents[0].id);
  }, [parents, parentId]);

  const initialRows = useMemo<Row[]>(() => {
    if (!parentId) return [];
    return relationships
      .filter((r) => r.type === "parent" && r.person1Id === parentId)
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((r) => ({ relId: r.id, child: persons.find((p) => p.id === r.person2Id)! }))
      .filter((row) => row.child);
  }, [parentId, persons, relationships]);

  const [rows, setRows] = useState<Row[]>(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((items) => {
      const oldIndex = items.findIndex((r) => r.relId === active.id);
      const newIndex = items.findIndex((r) => r.relId === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  async function save() {
    try {
      await updateChildOrder(rows.map((r) => r.relId));
      toast.success("Order saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (parents.length === 0) {
    return (
      <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        No parents with children yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Parent</span>
        <Select value={parentId} onValueChange={setParentId}>
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {parents.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={save} disabled={rows.length < 2}>Save order</Button>
      </div>
      {rows.length < 2 ? (
        <p className="text-sm text-muted-foreground">This parent has fewer than two children — nothing to reorder.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((r) => r.relId)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {rows.map((row, i) => (
                <SortableRow key={row.relId} id={row.relId} index={i} name={row.child.name} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableRow({ id, index, name }: { id: string; index: number; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded border bg-background px-3 py-2 text-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-xs text-muted-foreground">{index + 1}.</span>
      <span>{name}</span>
    </li>
  );
}
