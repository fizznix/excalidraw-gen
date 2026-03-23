import type { Diagram, LayoutNode } from "../types/index.js";

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const MIN_NODE_HEIGHT = 60;
const SPACING_X = 220; // horizontal gap between node left edges
const SPACING_GAP_Y = 70; // vertical gap between bottom of one row and top of next
const MARGIN_X = 80;
const MARGIN_Y = 80;

// Font constants mirrored from renderer — used to estimate node height from label
const FONT_SIZE = 16;
const LINE_HEIGHT = 1.25;
const CHAR_WIDTH_EST = 9;   // approximate px per character at fontSize 16
const TEXT_PADDING_X = 16;  // total horizontal text padding
const TEXT_PADDING_Y = 24;  // total vertical text padding

/** Estimate how many lines a label needs inside a box of the given width. */
function estimateLines(label: string, nodeWidth: number): number {
  const charsPerLine = Math.max(1, Math.floor((nodeWidth - TEXT_PADDING_X) / CHAR_WIDTH_EST));
  let lines = 0;
  for (const para of label.split("\n")) {
    lines += Math.max(1, Math.ceil(para.length / charsPerLine));
  }
  return lines;
}

/** Compute the effective node height accounting for label wrapping. */
function effectiveHeight(label: string, nodeWidth: number, styleHeight?: number): number {
  if (styleHeight !== undefined) return styleHeight;
  const lines = estimateLines(label, nodeWidth);
  const textH = Math.ceil(lines * FONT_SIZE * LINE_HEIGHT);
  return Math.max(MIN_NODE_HEIGHT, textH + TEXT_PADDING_Y);
}

/**
 * BFS-based layered DAG layout using Kahn's algorithm.
 * Each node is enqueued exactly once (when all its predecessors are processed),
 * so cycles can never cause an infinite loop — cycle nodes are placed after the
 * DAG portion at maxLevel + 1.
 */
export function layoutDAG(diagram: Diagram): LayoutNode[] {
  const { nodes, edges } = diagram;

  if (nodes.length === 0) return [];

  const nodeIds = nodes.map((n) => n.id);
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    if (edge.from !== edge.to) {
      adjacency.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  // ── Kahn's level assignment (no infinite loop) ────────────────────────────
  // A node is enqueued only when its in-degree reaches 0 (all predecessors done).
  // Cycle nodes never reach in-degree 0, so they never enter the queue.
  const inDegreeMut = new Map(inDegree);
  const level = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegreeMut) {
    if (deg === 0) {
      level.set(id, 0);
      queue.push(id);
    }
  }

  while (queue.length) {
    const curr = queue.shift()!;
    const currLevel = level.get(curr) ?? 0;
    for (const neighbor of adjacency.get(curr) ?? []) {
      // Longest-path level update
      const proposed = currLevel + 1;
      if (!level.has(neighbor) || proposed > (level.get(neighbor) ?? 0)) {
        level.set(neighbor, proposed);
      }
      const newDeg = (inDegreeMut.get(neighbor) ?? 0) - 1;
      inDegreeMut.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Place cycle nodes (never reached in-degree 0) after the DAG portion
  if (level.size === 0) {
    // Fully cyclic graph — all at level 0
    for (const id of nodeIds) level.set(id, 0);
  } else {
    const maxLevel = Math.max(...level.values());
    for (const id of nodeIds) {
      if (!level.has(id)) level.set(id, maxLevel + 1);
    }
  }

  // ── Group nodes by level ─────────────────────────────────────────────────
  const levelGroups = new Map<number, string[]>();
  for (const [id, lvl] of level) {
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl)!.push(id);
  }
  const sortedLevels = [...levelGroups.keys()].sort((a, b) => a - b);

  // Widest level (node count) drives the total canvas width
  const maxLevelCount = Math.max(...sortedLevels.map((l) => levelGroups.get(l)!.length));
  const totalCanvasWidth = maxLevelCount * SPACING_X;

  // ── Compute effective dimensions per node ─────────────────────────────────
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const nodeDims = new Map<string, { width: number; height: number }>();
  for (const id of nodeIds) {
    const n = nodeMap.get(id)!;
    const w = n.style?.width ?? DEFAULT_NODE_WIDTH;
    const h = effectiveHeight(n.label, w, n.style?.height);
    nodeDims.set(id, { width: w, height: h });
  }

  // ── Compute cumulative Y per level (dynamic row heights) ──────────────────
  let cumulativeY = MARGIN_Y;
  const levelY = new Map<number, number>();
  for (const lvl of sortedLevels) {
    levelY.set(lvl, cumulativeY);
    const maxH = Math.max(...levelGroups.get(lvl)!.map((id) => nodeDims.get(id)!.height));
    cumulativeY += maxH + SPACING_GAP_Y;
  }

  // ── Build LayoutNode array ───────────────────────────────────────────────
  const layoutNodes: LayoutNode[] = [];

  for (const lvl of sortedLevels) {
    const group = levelGroups.get(lvl)!;
    group.sort((a, b) => nodeIds.indexOf(a) - nodeIds.indexOf(b));

    const levelWidth = group.length * SPACING_X;
    const offsetX = MARGIN_X + Math.floor((totalCanvasWidth - levelWidth) / 2);

    group.forEach((id, colIndex) => {
      const inputNode = nodeMap.get(id)!;
      const { width, height } = nodeDims.get(id)!;
      layoutNodes.push({
        id,
        label: inputNode.label,
        type: inputNode.type ?? "process",
        metadata: inputNode.metadata,
        style: inputNode.style,
        x: offsetX + colIndex * SPACING_X,
        y: levelY.get(lvl)!,
        width,
        height,
        level: lvl,
        colIndex,
      });
    });
  }

  return layoutNodes;
}


/**
 * BFS-based layered DAG layout.
 * 1. Assign each node a level via BFS from roots (nodes with no incoming edges).
 * 2. Within each level, position nodes in a row and center each row against the widest row.
 */
