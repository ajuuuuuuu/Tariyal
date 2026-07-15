import type { Edge, Node } from "reactflow";
import type { Person, Relationship } from "./family-data";

// ---------- constants ----------
const NODE_W = 160;
const NODE_H = 100;
const SPOUSE_GAP = 24; // horizontal gap between husband and wife (kept small)
const SIBLING_GAP = 30; // horizontal gap between sibling subtrees
const GROUP_GAP = 60; // gap between children groups of different wives
const LEVEL_GAP = 80; // vertical gap between generations

// ---------- types ----------
type SubtreeLayout = {
  width: number;
  place: (offsetX: number, y: number) => void;
};

export function buildTree(
  persons: Person[],
  relationships: Relationship[],
  collapsedIds: Set<string> = new Set(),
): { nodes: Node[]; edges: Edge[]; hasChildrenOf: Set<string> } {
  const personById = new Map(persons.map((p) => [p.id, p]));
  const inTree = (id: string) => personById.has(id);

  // Pre-compute full child map from ALL relationships (needed for hidden set
  // regardless of collapse state).
  const rawChildrenOf = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type === "parent" && inTree(r.person1Id) && inTree(r.person2Id)) {
      if (!rawChildrenOf.has(r.person1Id)) rawChildrenOf.set(r.person1Id, []);
      rawChildrenOf.get(r.person1Id)!.push(r.person2Id);
    }
  }

  // Hidden = every descendant of a collapsed node (children, grandchildren, ...).
  const hiddenIds = new Set<string>();
  const stack: string[] = [];
  collapsedIds.forEach((id) => {
    for (const c of rawChildrenOf.get(id) ?? []) stack.push(c);
  });
  while (stack.length) {
    const cur = stack.pop()!;
    if (hiddenIds.has(cur)) continue;
    hiddenIds.add(cur);
    for (const c of rawChildrenOf.get(cur) ?? []) stack.push(c);
  }
  const visible = (id: string) => inTree(id) && !hiddenIds.has(id);

  // spouse map: personId -> [{id, sortOrder}] sorted by marriage order
  const spousesOf = new Map<string, { id: string; sortOrder: number }[]>();
  // parents map: childId -> parentIds
  const parentsOf = new Map<string, string[]>();
  // children map: parentId -> [{id, sortOrder}]
  const childrenOf = new Map<string, { id: string; sortOrder: number }[]>();

  for (const r of relationships) {
    if (r.type === "spouse" && visible(r.person1Id) && visible(r.person2Id)) {
      const so = r.sortOrder ?? 0;
      if (!spousesOf.has(r.person1Id)) spousesOf.set(r.person1Id, []);
      if (!spousesOf.has(r.person2Id)) spousesOf.set(r.person2Id, []);
      spousesOf.get(r.person1Id)!.push({ id: r.person2Id, sortOrder: so });
      spousesOf.get(r.person2Id)!.push({ id: r.person1Id, sortOrder: so });
    } else if (r.type === "parent" && visible(r.person1Id) && visible(r.person2Id)) {
      if (!parentsOf.has(r.person2Id)) parentsOf.set(r.person2Id, []);
      parentsOf.get(r.person2Id)!.push(r.person1Id);
      if (!childrenOf.has(r.person1Id)) childrenOf.set(r.person1Id, []);
      childrenOf.get(r.person1Id)!.push({ id: r.person2Id, sortOrder: r.sortOrder ?? 0 });
    }
  }
  spousesOf.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));
  childrenOf.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder));


  // Determine anchors:
  // - hasParentInTree → placed by their parent
  // - female with a husband in tree → placed by husband
  // - remaining → root anchor
  const hasParentInTree = new Set<string>();
  parentsOf.forEach((_, childId) => hasParentInTree.add(childId));

  const placedBySpouse = new Set<string>();
  for (const p of persons) {
    if (p.gender !== "female") continue;
    const sp = spousesOf.get(p.id) ?? [];
    const husband = sp.find((s) => personById.get(s.id)?.gender === "male");
    if (husband) placedBySpouse.add(p.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  // Layout a primary person plus their spouses & descendant tree
  const layoutPrimary = (id: string, y: number): SubtreeLayout => {
    if (visited.has(id)) return { width: 0, place: () => {} };
    visited.add(id);

    const primary = personById.get(id)!;
    const spouses = (spousesOf.get(id) ?? []).filter((s) => !visited.has(s.id));

    // Group primary's children by co-parent (the spouse they share with primary)
    const rawKids = childrenOf.get(id) ?? [];
    const kids = collapsedIds.has(id) ? [] : rawKids;
    const kidsByPartner = new Map<string | null, string[]>();
    for (const { id: kid } of kids) {
      const ps = parentsOf.get(kid) ?? [];
      let partner: string | null = null;
      for (const s of spouses) {
        if (ps.includes(s.id)) {
          partner = s.id;
          break;
        }
      }
      if (!kidsByPartner.has(partner)) kidsByPartner.set(partner, []);
      kidsByPartner.get(partner)!.push(kid);
    }

    const kidsY = y + NODE_H + LEVEL_GAP;

    const layoutKidGroup = (kidIds: string[]): SubtreeLayout => {
      if (kidIds.length === 0) return { width: 0, place: () => {} };
      const kidLayouts = kidIds.map((k) => layoutPrimary(k, kidsY));
      const totalW =
        kidLayouts.reduce((s, l) => s + l.width, 0) +
        Math.max(0, kidLayouts.length - 1) * SIBLING_GAP;
      return {
        width: totalW,
        place: (offsetX) => {
          let cursor = offsetX;
          for (const kl of kidLayouts) {
            kl.place(cursor, kidsY);
            cursor += kl.width + SIBLING_GAP;
          }
        },
      };
    };

    // Case A: 2+ spouses AND primary is male → polygamous layout
    // [wife1 kids] [wife1] [husband] [wife2] [wife2 kids] [wife3] [wife3 kids] ...
    if (spouses.length >= 2 && primary.gender === "male") {
      const [w1, ...rest] = spouses;
      const w1Kids = layoutKidGroup(kidsByPartner.get(w1.id) ?? []);
      const rightData = rest.map((w) => ({
        wife: w,
        kids: layoutKidGroup(kidsByPartner.get(w.id) ?? []),
      }));
      const motherlessKids = layoutKidGroup(kidsByPartner.get(null) ?? []);

      // Local coordinates: husband center at x = 0.
      const husbandX = 0;
      const wife1X = -(NODE_W + SPOUSE_GAP);
      const w1Mid = (husbandX + wife1X) / 2; // where w1's kids center

      // Left edge candidate
      let leftEdge = Math.min(wife1X - NODE_W / 2, w1Mid - w1Kids.width / 2);

      // Right side chain
      let prevRightEdge = husbandX + NODE_W / 2;
      let prevPartnerX = husbandX;
      const rightPlacements: {
        wifeX: number;
        kidsCenter: number;
        wife: { id: string; sortOrder: number };
        kids: SubtreeLayout;
      }[] = [];
      for (const { wife, kids } of rightData) {
        const wifeX = prevRightEdge + SPOUSE_GAP + NODE_W / 2;
        const kidsCenter = (prevPartnerX + wifeX) / 2;
        // Ensure kids don't collide left of prevRightEdge
        const kidsLeftWant = kidsCenter - kids.width / 2;
        const shift = Math.max(0, prevRightEdge + 10 - kidsLeftWant);
        // If kids overflow left, keep kids under midpoint but that midpoint
        // already sits to the right of prevRightEdge in normal cases.
        const kidsCenterFinal = kidsCenter + (kids.width === 0 ? 0 : shift);
        rightPlacements.push({ wifeX, kidsCenter: kidsCenterFinal, wife, kids });
        prevRightEdge = Math.max(
          wifeX + NODE_W / 2,
          kidsCenterFinal + kids.width / 2,
        );
        prevPartnerX = wifeX;
      }
      const rightEdge = prevRightEdge;
      const width = rightEdge - leftEdge;

      return {
        width,
        place: (offsetX, yy) => {
          const baseX = offsetX - leftEdge; // translate so husbandX(0) sits at baseX
          positions.set(primary.id, { x: baseX + husbandX - NODE_W / 2, y: yy });
          positions.set(w1.id, { x: baseX + wife1X - NODE_W / 2, y: yy });
          visited.add(w1.id);
          if (w1Kids.width > 0) {
            w1Kids.place(baseX + w1Mid - w1Kids.width / 2, kidsY);
          }
          for (const rp of rightPlacements) {
            positions.set(rp.wife.id, {
              x: baseX + rp.wifeX - NODE_W / 2,
              y: yy,
            });
            visited.add(rp.wife.id);
            if (rp.kids.width > 0) {
              rp.kids.place(baseX + rp.kidsCenter - rp.kids.width / 2, kidsY);
            }
          }
          if (motherlessKids.width > 0) {
            motherlessKids.place(
              baseX + husbandX - motherlessKids.width / 2,
              kidsY,
            );
          }
        },
      };
    }

    // Case B: exactly 1 spouse → couple side-by-side
    if (spouses.length === 1) {
      const partner = spouses[0];
      const kidIds = [
        ...(kidsByPartner.get(partner.id) ?? []),
        ...(kidsByPartner.get(null) ?? []),
      ];
      const kidsGroup = layoutKidGroup(kidIds);
      const coupleW = NODE_W + SPOUSE_GAP + NODE_W;
      const width = Math.max(coupleW, kidsGroup.width);
      // primary on left, spouse on right (husband always left of wife; if
      // primary is female with husband, still primary left, spouse right —
      // the spouse edge dashes remain correct).
      const coupleStart = (width - coupleW) / 2;
      const primaryCenter = coupleStart + NODE_W / 2;
      const partnerCenter = coupleStart + NODE_W + SPOUSE_GAP + NODE_W / 2;
      return {
        width,
        place: (offsetX, yy) => {
          positions.set(primary.id, {
            x: offsetX + primaryCenter - NODE_W / 2,
            y: yy,
          });
          positions.set(partner.id, {
            x: offsetX + partnerCenter - NODE_W / 2,
            y: yy,
          });
          visited.add(partner.id);
          if (kidsGroup.width > 0) {
            const coupleMid = (primaryCenter + partnerCenter) / 2;
            kidsGroup.place(offsetX + coupleMid - kidsGroup.width / 2, kidsY);
          }
        },
      };
    }

    // Case C: no spouse → primary alone with own children (motherless)
    const kidsGroup = layoutKidGroup(kidsByPartner.get(null) ?? []);
    const width = Math.max(NODE_W, kidsGroup.width);
    return {
      width,
      place: (offsetX, yy) => {
        positions.set(primary.id, {
          x: offsetX + width / 2 - NODE_W / 2,
          y: yy,
        });
        if (kidsGroup.width > 0) {
          kidsGroup.place(offsetX + width / 2 - kidsGroup.width / 2, kidsY);
        }
      },
    };
  };

  // Roots: not placed by spouse, no parent in tree
  const roots = persons.filter(
    (p) => !placedBySpouse.has(p.id) && !hasParentInTree.has(p.id),
  );

  // Lay out each root subtree horizontally
  let cursor = 0;
  const ROOT_GAP = GROUP_GAP * 2;
  for (const root of roots) {
    if (visited.has(root.id)) continue;
    const l = layoutPrimary(root.id, 0);
    l.place(cursor, 0);
    cursor += l.width + ROOT_GAP;
  }

  // Any remaining un-placed VISIBLE persons (orphans / cycles) — stack them off to the side
  for (const p of persons) {
    if (hiddenIds.has(p.id)) continue;
    if (positions.has(p.id)) continue;
    positions.set(p.id, { x: cursor, y: 0 });
    cursor += NODE_W + SIBLING_GAP;
  }

  // Build reactflow nodes (skip hidden descendants of collapsed nodes)
  const nodes: Node[] = persons
    .filter((p) => !hiddenIds.has(p.id))
    .map((p) => {
      const pos = positions.get(p.id) ?? { x: 0, y: 0 };
      return {
        id: p.id,
        type: "person",
        position: pos,
        data: { person: p },
      };
    });

  // Edges (skip anything touching a hidden node)
  const edges: Edge[] = [];
  for (const r of relationships) {
    if (!visible(r.person1Id) || !visible(r.person2Id)) continue;
    if (r.type === "parent") {
      edges.push({
        id: r.id,
        source: r.person1Id,
        target: r.person2Id,
        type: "smoothstep",
        style: { stroke: "hsl(220 60% 50%)", strokeWidth: 2 },
      });
    } else if (r.type === "spouse") {
      const p1 = positions.get(r.person1Id);
      const p2 = positions.get(r.person2Id);
      const p1IsLeft = (p1?.x ?? 0) <= (p2?.x ?? 0);
      edges.push({
        id: r.id,
        source: p1IsLeft ? r.person1Id : r.person2Id,
        target: p1IsLeft ? r.person2Id : r.person1Id,
        type: "straight",
        animated: false,
        style: {
          stroke: "hsl(340 70% 55%)",
          strokeWidth: 2,
          strokeDasharray: "6 4",
        },
        sourceHandle: "right",
        targetHandle: "left",
      });
    }
  }

  // hasChildrenOf reflects the RAW tree so collapsed nodes still show the chevron.
  const hasChildrenOf = new Set<string>(rawChildrenOf.keys());
  return { nodes, edges, hasChildrenOf };
}


export function getYear(date?: string): string {
  if (!date) return "";
  return date.slice(0, 4);
}
