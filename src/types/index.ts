// ============================================================
// Input Types — what the user provides
// ============================================================

export type DiagramType = "flowchart" | "architecture";

/**
 * Per-node visual overrides — any field here wins over the template default.
 * An agent can supply any combination; omitted fields fall back to the template.
 */
export interface NodeStyle {
  /** Fill color, e.g. "#ff6b6b" or "transparent" */
  backgroundColor?: string;
  /** Border/stroke color */
  strokeColor?: string;
  /** Border thickness in px */
  strokeWidth?: number;
  /** Border style */
  strokeStyle?: "solid" | "dashed" | "dotted";
  /** Fill pattern */
  fillStyle?: "solid" | "hachure" | "cross-hatch" | "zigzag";
  /** Force a specific shape, overriding the template */
  shape?: "rectangle" | "ellipse";
  /** Override node width in px */
  width?: number;
  /** Override node height in px */
  height?: number;
  /** Opacity 0–100 */
  opacity?: number;
}

/**
 * Per-edge visual overrides for arrows.
 */
export interface EdgeStyle {
  /** Arrow stroke color */
  strokeColor?: string;
  /** Arrow line style */
  strokeStyle?: "solid" | "dashed" | "dotted";
  /** Arrow stroke thickness */
  strokeWidth?: number;
  /** Opacity 0–100 */
  opacity?: number;
}

export interface InputNode {
  id: string;
  label: string;
  type?: string;
  metadata?: Record<string, unknown>;
  /** Optional per-node style overrides */
  style?: NodeStyle;
}

export interface InputEdge {
  from: string;
  to: string;
  label?: string;
  bidirectional?: boolean;
  /** Optional per-edge style overrides */
  style?: EdgeStyle;
}

export interface Diagram {
  type: DiagramType;
  nodes: InputNode[];
  edges: InputEdge[];
  title?: string;
}

// ============================================================
// Validation Types
// ============================================================

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

// ============================================================
// Template & Theme Types
// ============================================================

export type ShapeType = "rectangle" | "ellipse";

export type StrokeStyle = "solid" | "dashed" | "dotted";

export interface TemplateStyle {
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  /** roundness object for Excalidraw, or null for sharp corners */
  roundness: { type: number } | null;
}

export interface TemplateNodeDef {
  shape: ShapeType;
  style: TemplateStyle;
}

export interface TemplateDefinition {
  name: string;
  /** Maps node.type → visual definition */
  nodes: Record<string, TemplateNodeDef>;
  /** Fallback if node.type not in nodes map */
  defaultNode: TemplateNodeDef;
}

export type Theme = "default" | "pastel" | "dark";

export type LayoutType = "dag" | "grid";

// ============================================================
// Layout Types — nodes with computed positions
// ============================================================

export interface LayoutNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
  /** Carries through any user-supplied style overrides */
  style?: NodeStyle;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  colIndex: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  bidirectional?: boolean;
  /** Carries through any user-supplied edge style overrides */
  style?: EdgeStyle;
}

export type EdgeSide = "top" | "bottom" | "left" | "right";

export interface EdgeAnchor {
  x: number;
  y: number;
  side: EdgeSide;
  /** fixedPoint for Excalidraw startBinding/endBinding */
  fixedPoint: [number, number];
}

export interface ArrowRoute {
  sourceAnchor: EdgeAnchor;
  targetAnchor: EdgeAnchor;
  /** Relative point offsets, first is always [0, 0] */
  points: [number, number][];
  /** Bounding box width = max(abs(p[0])) across all points */
  width: number;
  /** Bounding box height = max(abs(p[1])) across all points */
  height: number;
}

// ============================================================
// Excalidraw Output Types — must match Excalidraw JSON spec exactly
// ============================================================

export interface ExcalidrawBoundElement {
  type: "text" | "arrow";
  id: string;
}

export interface ExcalidrawBinding {
  elementId: string;
  focus: number;
  gap: number;
  fixedPoint: [number, number];
}

export interface ExcalidrawRoundness {
  type: number;
}

export interface ExcalidrawBaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: 0;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch" | "zigzag";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: string | null;
  roundness: ExcalidrawRoundness | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: false;
  boundElements: ExcalidrawBoundElement[] | null;
  updated: number;
  link: string | null;
  locked: false;
}

export interface ExcalidrawRectangle extends ExcalidrawBaseElement {
  type: "rectangle";
}

export interface ExcalidrawEllipse extends ExcalidrawBaseElement {
  type: "ellipse";
}

export interface ExcalidrawText extends ExcalidrawBaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  baseline: number;
  containerId: string | null;
  originalText: string;
  lineHeight: number;
}

export interface ExcalidrawArrow extends ExcalidrawBaseElement {
  type: "arrow";
  points: [number, number][];
  lastCommittedPoint: null;
  startBinding: ExcalidrawBinding | null;
  endBinding: ExcalidrawBinding | null;
  startArrowhead: "arrow" | "bar" | "dot" | "triangle" | null;
  endArrowhead: "arrow" | "bar" | "dot" | "triangle" | null;
  elbowed: boolean;
}

export interface ExcalidrawLine extends ExcalidrawBaseElement {
  type: "line";
  points: [number, number][];
  lastCommittedPoint: null;
}

export type ExcalidrawElement =
  | ExcalidrawRectangle
  | ExcalidrawEllipse
  | ExcalidrawText
  | ExcalidrawArrow
  | ExcalidrawLine;

export interface ExcalidrawAppState {
  gridSize: number;
  viewBackgroundColor: string;
}

export interface ExcalidrawFile {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: ExcalidrawAppState;
  files: Record<string, never>;
}

// ============================================================
// Pipeline Options
// ============================================================

export interface GenerateOptions {
  template: "flowchart" | "architecture";
  theme: Theme;
  layout: LayoutType;
  out?: string;
  deterministic: boolean;
  maxNodes: number;
}
