import type { Diagram, LayoutNode } from "../types/index.js";

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const MIN_NODE_HEIGHT = 60;
const SPACING_X = 220;
const SPACING_Y = 150;
const MARGIN_X = 80;
const MARGIN_Y = 80;
const FONT_SIZE = 16;
const LINE_HEIGHT = 1.25;
const CHAR_WIDTH_EST = 9;
const TEXT_PADDING_X = 16;
const TEXT_PADDING_Y = 24;

function effectiveHeight(label: string, nodeWidth: number, styleHeight?: number): number {
  if (styleHeight !== undefined) return styleHeight;
  const charsPerLine = Math.max(1, Math.floor((nodeWidth - TEXT_PADDING_X) / CHAR_WIDTH_EST));
  let lines = 0;
  for (const para of label.split("\n")) {
    lines += Math.max(1, Math.ceil(para.length / charsPerLine));
  }
  return Math.max(MIN_NODE_HEIGHT, Math.ceil(lines * FONT_SIZE * LINE_HEIGHT) + TEXT_PADDING_Y);
}

/** Simple grid layout: arranges nodes in rows of sqrt(n) columns */
export function layoutGrid(diagram: Diagram): LayoutNode[] {
  const { nodes } = diagram;
  if (nodes.length === 0) return [];

  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));

  return nodes.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const w = node.style?.width ?? DEFAULT_NODE_WIDTH;
    const h = effectiveHeight(node.label, w, node.style?.height);
    return {
      id: node.id,
      label: node.label,
      type: node.type ?? "process",
      metadata: node.metadata,
      style: node.style,
      x: MARGIN_X + col * SPACING_X,
      y: MARGIN_Y + row * SPACING_Y,
      width: w,
      height: h,
      level: row,
      colIndex: col,
    };
  });
}
