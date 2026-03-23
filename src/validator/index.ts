import type { Diagram, InputEdge, ValidationResult } from "../types/index.js";

const DEFAULT_MAX_NODES = 200;

/** DFS cycle detection using tri-color marking */
function hasCycle(
  nodeIds: Set<string>,
  adjacency: Map<string, string[]>
): string | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);

  function dfs(id: string): string | null {
    color.set(id, GRAY);
    for (const neighbor of adjacency.get(id) ?? []) {
      const c = color.get(neighbor) ?? WHITE;
      if (c === GRAY) return `${id} → ${neighbor}`;
      if (c === WHITE) {
        const found = dfs(neighbor);
        if (found) return found;
      }
    }
    color.set(id, BLACK);
    return null;
  }

  for (const id of nodeIds) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      const found = dfs(id);
      if (found) return found;
    }
  }
  return null;
}

export function validate(
  diagram: Diagram,
  opts?: { maxNodes?: number }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const maxNodes = opts?.maxNodes ?? DEFAULT_MAX_NODES;
  const { nodes, edges } = diagram;

  // ── Error: empty nodes ─────────────────────────────────────
  if (nodes.length === 0) {
    errors.push("Diagram must have at least one node");
    return { errors, warnings };
  }

  // ── Error: too many nodes ──────────────────────────────────
  if (nodes.length > maxNodes) {
    errors.push(
      `Node count (${nodes.length}) exceeds maximum allowed (${maxNodes})`
    );
  }

  // ── Error: duplicate node IDs ──────────────────────────────
  const seenIds = new Set<string>();
  const duplicates = new Set<string>();
  for (const node of nodes) {
    if (seenIds.has(node.id)) duplicates.add(node.id);
    seenIds.add(node.id);
  }
  for (const id of duplicates) {
    errors.push(`Duplicate node ID: "${id}"`);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // ── Error: self-loops (prevent preflight crash) ────────────
  const selfLoops = edges.filter((e) => e.from === e.to);
  for (const loop of selfLoops) {
    errors.push(
      `Self-loop on node "${loop.from}" — remove the edge or use a separate node to represent recursion`
    );
  }

  // ── Error: edges referencing non-existent nodes ────────────
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references unknown node: "${edge.from}" (in "from")`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references unknown node: "${edge.to}" (in "to")`);
    }
  }

  // Build adjacency (exclude self-loops and bad refs)
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    if (edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
      adjacency.get(edge.from)!.push(edge.to);
    }
  }

  // ── Warning: cycles (all diagram types) ───────────────────
  const cycleEdge = hasCycle(nodeIds, adjacency);
  if (cycleEdge) {
    warnings.push(
      `Cycle detected: ${cycleEdge} — cyclic nodes will be placed at the end of the layout`
    );
  }

  // ── Warning: disconnected nodes ────────────────────────────
  if (edges.length > 0) {
    // Build undirected adjacency for connectivity check
    const undirectedAdj = new Map<string, string[]>();
    for (const id of nodeIds) undirectedAdj.set(id, []);
    for (const edge of edges) {
      if (edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        undirectedAdj.get(edge.from)!.push(edge.to);
        undirectedAdj.get(edge.to)!.push(edge.from);
      }
    }

    // Start BFS from a node that actually has edges (avoids isolated-node false positives)
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      if (edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to)) {
        connectedNodes.add(edge.from);
        connectedNodes.add(edge.to);
      }
    }
    const bfsStart = connectedNodes.size > 0
      ? [...connectedNodes][0]
      : nodes[0].id;

    const visited = new Set<string>();
    const bfsQueue = [bfsStart];
    while (bfsQueue.length) {
      const curr = bfsQueue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const n of undirectedAdj.get(curr) ?? []) {
        if (!visited.has(n)) bfsQueue.push(n);
      }
    }
    for (const id of nodeIds) {
      if (!visited.has(id)) {
        warnings.push(`Node "${id}" is disconnected (not reachable from any other node)`);
      }
    }
  }

  return { errors, warnings };
}


