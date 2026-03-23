import type { Diagram, InputNode } from "../types/index.js";

const DEFAULT_NODE_TYPE = "process";

export function normalize(diagram: Diagram): { diagram: Diagram; warnings: string[] } {
  const warnings: string[] = [];

  const nodes: InputNode[] = diagram.nodes.map((node) => ({
    ...node,
    id: node.id.trim(),
    label: node.label.trim(),
    type: (node.type ?? DEFAULT_NODE_TYPE).trim().toLowerCase(),
    metadata: node.metadata ?? {},
  }));

  // Deduplicate edges: same directed from/to pair — keep first, warn on extras
  const seenEdges = new Map<string, string | undefined>(); // key → label of first seen
  const edges = diagram.edges
    .filter((edge) => {
      const key = `${edge.from.trim()}→${edge.to.trim()}`;
      if (seenEdges.has(key)) {
        warnings.push(
          `Duplicate edge "${edge.from}" → "${edge.to}" dropped (only the first is kept)`
        );
        return false;
      }
      seenEdges.set(key, edge.label);
      return true;
    })
    .map((edge) => ({
      ...edge,
      from: edge.from.trim(),
      to: edge.to.trim(),
      label: edge.label?.trim(),
    }));

  return {
    diagram: { ...diagram, nodes, edges, title: diagram.title?.trim() },
    warnings,
  };
}
