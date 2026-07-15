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
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonEditor } from "./PersonEditor";
import type { Person, Relationship } from "@/lib/family-data";
import {
  addWife,
  removeSpouseLink,
  updateRelationshipOrder,
} from "@/lib/family-api";
import { toast } from "sonner";

interface Row {
  relId: string;
  wife: Person;
}

export function SpouseManager({
  persons,
  relationships,
  onSaved,
  initialHusbandId,
}: {
  persons: Person[];
  relationships: Relationship[];
  onSaved: () => void;
  initialHusbandId?: string;
}) {
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  // Husbands = males who have at least one female spouse in tree
  const husbands = useMemo(() => {
    const set = new Set<string>();
    for (const r of relationships) {
      if (r.type !== "spouse") continue;
      const a = personById.get(r.person1Id);
      const b = personById.get(r.person2Id);
      if (a?.gender === "male" && b?.gender === "female") set.add(a.id);
      if (b?.gender === "male" && a?.gender === "female") set.add(b.id);
    }
    // Also include all males so admins can add a first wife from here.
    for (const p of persons) if (p.gender === "male") set.add(p.id);
    return persons.filter((p) => set.has(p.id));
  }, [persons, relationships, personById]);

  const [husbandId, setHusbandId] = useState<string>(initialHusbandId ?? "");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (initialHusbandId) setHusbandId(initialHusbandId);
  }, [initialHusbandId]);

  useEffect(() => {
    if (!husbandId && husbands[0]) setHusbandId(husbands[0].id);
  }, [husbands, husbandId]);

  const wifeRows = useMemo<Row[]>(() => {
    if (!husbandId) return [];
    return relationships
      .filter(
        (r) =>
          r.type === "spouse" &&
          (r.person1Id === husbandId || r.person2Id === husbandId),
      )
      .map((r) => {
        const otherId = r.person1Id === husbandId ? r.person2Id : r.person1Id;
        return { relId: r.id, sortOrder: r.sortOrder ?? 0, other: personById.get(otherId) };
      })
      .filter((x) => x.other && x.other.gender === "female")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((x) => ({ relId: x.relId, wife: x.other as Person }));
  }, [husbandId, relationships, personById]);

  const [rows, setRows] = useState<Row[]>(wifeRows);
  useEffect(() => setRows(wifeRows), [wifeRows]);

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

  async function saveOrder() {
    try {
      await updateRelationshipOrder(rows.map((r) => r.relId));
      toast.success("Wife order saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeWife(wifeId: string, wifeName: string) {
    if (!confirm(`Remove ${wifeName} as a wife? (Person and children are kept.)`)) return;
    try {
      await removeSpouseLink(husbandId, wifeId);
      toast.success("Wife removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const husband = personById.get(husbandId);

  if (husbands.length === 0) {
    return (
      <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        No males in the tree yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Husband</span>
        <Select value={husbandId} onValueChange={setHusbandId}>
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {husbands.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)} disabled={!husbandId}>
          Add wife
        </Button>
        <Button size="sm" onClick={saveOrder} disabled={rows.length < 2}>
          Save order
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {husband?.name ?? "This person"} has no wives yet. Use "Add wife" above.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Order shown left-to-right in the tree. Wife #1 sits left of the husband;
            wives #2+ sit to the right in order.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r.relId)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {rows.map((row, i) => (
                  <SortableWife
                    key={row.relId}
                    id={row.relId}
                    index={i}
                    name={row.wife.name}
                    onRemove={() => removeWife(row.wife.id, row.wife.name)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add wife for {husband?.name}</DialogTitle>
          </DialogHeader>
          <PersonEditor
            initial={{ gender: "female", familyGroup: husband?.familyGroup }}
            onCancel={() => setAddOpen(false)}
            onSubmit={async (data) => {
              try {
                await addWife(
                  husbandId,
                  {
                    name: data.name,
                    birthDate: data.birthDate,
                    deathDate: data.deathDate,
                    photoUrl: data.photoUrl,
                    biography: data.biography,
                    familyGroup: data.familyGroup ?? husband?.familyGroup,
                  },
                  rows.length,
                );
                toast.success("Wife added");
                setAddOpen(false);
                onSaved();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableWife({
  id,
  index,
  name,
  onRemove,
}: {
  id: string;
  index: number;
  name: string;
  onRemove: () => void;
}) {
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
      <span className="w-6 text-xs text-muted-foreground">#{index + 1}</span>
      <span className="flex-1">{name}</span>
      <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove wife">
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
