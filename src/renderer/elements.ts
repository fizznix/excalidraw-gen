import type {
  LayoutNode,
  LayoutEdge,
  TemplateNodeDef,
  ArrowRoute,
  ExcalidrawElement,
  ExcalidrawText,
  ExcalidrawArrow,
  ExcalidrawBoundElement,
  NodeStyle,
  EdgeStyle,
} from "../types/index.js";
import { hashId } from "./seed.js";

const FONT_SIZE = 16;
const LINE_HEIGHT = 1.25;
const TEXT_PADDING_X = 16; // total horizontal padding (8px per side)
const TEXT_Y_PADDING = 5;
const CHAR_WIDTH_EST = 9;

/**
 * Estimate line count accounting for word wrap inside a given width.
 * Matches the estimation used by the layout engine so sizes stay consistent.
 */
function estimateLines(text: string, nodeWidth: number): number {
  const charsPerLine = Math.max(1, Math.floor((nodeWidth - TEXT_PADDING_X) / CHAR_WIDTH_EST));
  let lines = 0;
  for (const para of text.split("\n")) {
    lines += Math.max(1, Math.ceil(para.length / charsPerLine));
  }
  return lines;
}

function estimateTextHeight(text: string, nodeWidth: number): number {
  return Math.ceil(estimateLines(text, nodeWidth) * FONT_SIZE * LINE_HEIGHT);
}

/** Build the common base fields every Excalidraw element needs */
function baseFields(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    id,
    x,
    y,
    width,
    height,
    angle: 0 as const,
    fillStyle: "solid" as const,
    opacity: 100,
    groupIds: [] as string[],
    frameId: null,
    seed: hashId(id),
    version: 1,
    versionNonce: hashId(id + "_v"),
    isDeleted: false as const,
    updated: 1,
    link: null,
    locked: false as const,
  };
}

// ── Shape element (rectangle or ellipse) ────────────────────────────────────

export function createShapeElements(
  node: LayoutNode,
  nodeDef: TemplateNodeDef
): [ExcalidrawElement, ExcalidrawText] {
  const { id, label, x, y, width, height, style } = node;

  // Merge template defaults with per-node style overrides
  const effectiveStyle = {
    strokeColor:     style?.strokeColor     ?? nodeDef.style.strokeColor,
    backgroundColor: style?.backgroundColor ?? nodeDef.style.backgroundColor,
    strokeWidth:     style?.strokeWidth     ?? nodeDef.style.strokeWidth,
    strokeStyle:     style?.strokeStyle     ?? nodeDef.style.strokeStyle,
    roundness:       nodeDef.style.roundness,
    fillStyle:       (style?.fillStyle      ?? "solid") as ExcalidrawElement["fillStyle"],
    opacity:         style?.opacity         ?? 100,
  };

  // Shape can be overridden per-node
  const shapeType = (style?.shape ?? nodeDef.shape) as "rectangle" | "ellipse";

  const textId = `${id}-text`;
  const boundElements: ExcalidrawBoundElement[] = [{ type: "text", id: textId }];

  const shapeEl: ExcalidrawElement = {
    ...baseFields(id, x, y, width, height),
    type: shapeType,
    strokeColor:     effectiveStyle.strokeColor,
    backgroundColor: effectiveStyle.backgroundColor,
    strokeWidth:     effectiveStyle.strokeWidth,
    strokeStyle:     effectiveStyle.strokeStyle,
    roughness: 1,
    roundness: effectiveStyle.roundness,
    fillStyle: effectiveStyle.fillStyle,
    opacity:   effectiveStyle.opacity,
    boundElements,
  } as ExcalidrawElement;

  const textHeight = estimateTextHeight(label, width);
  const textX = x + TEXT_PADDING_X / 2;
  const textY = y + Math.max(TEXT_Y_PADDING, (height - textHeight) / 2);
  const textWidth = width - TEXT_PADDING_X;

  const textEl: ExcalidrawText = {
    ...baseFields(textId, textX, textY, textWidth, textHeight),
    type: "text",
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    boundElements: null,
    text: label,
    originalText: label,
    fontSize: FONT_SIZE,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: Math.ceil(FONT_SIZE * 0.8),
    containerId: id,
    lineHeight: LINE_HEIGHT,
  };

  return [shapeEl, textEl];
}

// ── Arrow element ────────────────────────────────────────────────────────────

export function createArrowElement(
  edge: LayoutEdge,
  route: ArrowRoute,
  defaultStrokeColor: string
): ExcalidrawArrow {
  const arrowId = `arrow-${edge.from}-${edge.to}`;
  const { sourceAnchor, targetAnchor, points, width, height } = route;

  // Apply per-edge style overrides on top of the template-derived color
  const strokeColor     = edge.style?.strokeColor  ?? defaultStrokeColor;
  const strokeStyle     = edge.style?.strokeStyle  ?? "solid";
  const strokeWidth     = edge.style?.strokeWidth  ?? 2;
  const opacity         = edge.style?.opacity      ?? 100;

  const arrow: ExcalidrawArrow = {
    ...baseFields(arrowId, sourceAnchor.x, sourceAnchor.y, width, height),
    type: "arrow",
    strokeColor,
    backgroundColor: "transparent",
    strokeWidth,
    strokeStyle,
    opacity,
    roughness: 0,
    roundness: null,
    boundElements: null,
    points,
    lastCommittedPoint: null,
    startArrowhead: edge.bidirectional ? "arrow" : null,
    endArrowhead: "arrow",
    elbowed: true,
    startBinding: {
      elementId: edge.from,
      focus: 0,
      gap: 1,
      fixedPoint: sourceAnchor.fixedPoint,
    },
    endBinding: {
      elementId: edge.to,
      focus: 0,
      gap: 1,
      fixedPoint: targetAnchor.fixedPoint,
    },
  };

  return arrow;
}

// ── Arrow label element ──────────────────────────────────────────────────────

/**
 * Find the geometric midpoint along the actual elbow path (not just anchor midpoint).
 * This ensures labels appear ON the arrow line, not floating in empty space.
 */
function pathMidpoint(route: ArrowRoute): { x: number; y: number } {
  const { sourceAnchor, points } = route;
  // Convert relative points to absolute coords
  const abs: [number, number][] = points.map(([dx, dy]) => [
    sourceAnchor.x + dx,
    sourceAnchor.y + dy,
  ]);

  // Compute segment lengths
  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 1; i < abs.length; i++) {
    const len = Math.hypot(abs[i][0] - abs[i - 1][0], abs[i][1] - abs[i - 1][1]);
    segLengths.push(len);
    totalLen += len;
  }

  // Walk to the 50% mark
  const half = totalLen / 2;
  let accum = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const next = accum + segLengths[i];
    if (next >= half) {
      const t = segLengths[i] > 0 ? (half - accum) / segLengths[i] : 0;
      return {
        x: abs[i][0] + t * (abs[i + 1][0] - abs[i][0]),
        y: abs[i][1] + t * (abs[i + 1][1] - abs[i][1]),
      };
    }
    accum = next;
  }

  // Fallback: last point
  const last = abs[abs.length - 1];
  return { x: last[0], y: last[1] };
}

export function createArrowLabel(
  edge: LayoutEdge,
  route: ArrowRoute
): ExcalidrawText {
  const { x: mx, y: my } = pathMidpoint(route);
  const labelId = `arrow-${edge.from}-${edge.to}-label`;
  const text = edge.label!;
  const labelWidth = Math.max(60, text.length * 8); // rough proportional width
  const textHeight = estimateTextHeight(text, labelWidth);

  return {
    ...baseFields(labelId, mx - labelWidth / 2, my - textHeight / 2 - 10, labelWidth, textHeight),
    type: "text",
    strokeColor: "#495057",
    backgroundColor: "#ffffff",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    boundElements: null,
    text,
    originalText: text,
    fontSize: 13,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: Math.ceil(13 * 0.8),
    containerId: null,
    lineHeight: LINE_HEIGHT,
  };
}

