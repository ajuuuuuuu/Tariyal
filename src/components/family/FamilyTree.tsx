import { useCallback, useMemo, useState } from "react";
import type { ComponentType } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { PersonNode } from "./PersonNode";
import { buildTree } from "@/lib/tree-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Person, Relationship } from "@/lib/family-data";

const nodeTypes = { person: PersonNode } as const;
const memoizedNodeTypes = nodeTypes as Record<string, ComponentType<any>>;

export function FamilyTree({
  persons,
  relationships,
  onSelect,
  onOpen,
  highlightId,
  relatedIds,
}: {
  persons: Person[];
  relationships: Relationship[];
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  highlightId?: string | null;
  relatedIds?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nodes, edges, hasChildrenOf } = useMemo(
    () => buildTree(persons, relationships, collapsed),
    [persons, relationships, collapsed],
  );

  const styledNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => {
        const base: Node = {
          ...n,
          data: {
            ...n.data,
            hasChildren: hasChildrenOf.has(n.id),
            collapsed: collapsed.has(n.id),
            onToggleCollapse: toggleCollapse,
          },
        };
        if (n.id === highlightId) {
          return {
            ...base,
            style: { ...n.style, outline: "3px solid hsl(45 95% 55%)", borderRadius: 12 },
          };
        }
        if (relatedIds?.has(n.id)) {
          return {
            ...base,
            style: { ...n.style, outline: "2px solid hsl(160 70% 45%)", borderRadius: 12 },
          };
        }
        return base;
      }),
    [nodes, hasChildrenOf, collapsed, toggleCollapse, highlightId, relatedIds],
  );

  const [rfKey] = useState(() => Math.random());
  const isMobile = useIsMobile();

  return (
    <ReactFlow
      key={rfKey}
      nodes={styledNodes}
      edges={edges}
      nodeTypes={memoizedNodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onNodeDoubleClick={(_, node) => onOpen?.(node.id)}
      fitView
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} />
      <Controls showInteractive={false} />
      <MiniMap
        className="bottom-3! right-3! rounded-lg border border-yellow-600/40 bg-slate-900/80 shadow-lg backdrop-blur-sm"
        style={{
          width: isMobile ? 120 : 200,
          height: isMobile ? 80 : 150,
        }}
        pannable
        zoomable
      />
    </ReactFlow>
  );
}
