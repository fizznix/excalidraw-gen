import type {
  TemplateDefinition,
  TemplateNodeDef,
  TemplateStyle,
} from "../types/index.js";

// ── Shared style builders ────────────────────────────────────────────────────

function rectStyle(
  bg: string,
  stroke: string,
  strokeWidth = 2,
  strokeStyle: "solid" | "dashed" | "dotted" = "solid"
): TemplateStyle {
  return {
    backgroundColor: bg,
    strokeColor: stroke,
    strokeWidth,
    strokeStyle,
    roundness: { type: 3 },
  };
}

function ellipseStyle(bg: string, stroke: string): TemplateStyle {
  return {
    backgroundColor: bg,
    strokeColor: stroke,
    strokeWidth: 2,
    strokeStyle: "solid",
    roundness: { type: 2 },
  };
}

function rectNode(
  bg: string,
  stroke: string,
  sw?: number,
  ss?: "solid" | "dashed" | "dotted"
): TemplateNodeDef {
  return { shape: "rectangle", style: rectStyle(bg, stroke, sw, ss) };
}

function ellipseNode(bg: string, stroke: string): TemplateNodeDef {
  return { shape: "ellipse", style: ellipseStyle(bg, stroke) };
}

// ── Default fallback node ────────────────────────────────────────────────────

const DEFAULT_NODE: TemplateNodeDef = rectNode("#f8f9fa", "#495057");

// ── Flowchart template ───────────────────────────────────────────────────────
//
// IMPORTANT: Decision nodes use orange+dashed rectangle — NOT diamond.
// diamond type has broken arrow connections in raw Excalidraw JSON.

const FLOWCHART_TEMPLATE: TemplateDefinition = {
  name: "flowchart",
  nodes: {
    start: ellipseNode("#e7f5ff", "#1971c2"),
    end: ellipseNode("#fff0f6", "#c2255c"),
    process: rectNode("#d0bfff", "#7048e8"),
    // decision → orange dashed rect (NOT diamond — known Excalidraw JSON bug)
    decision: rectNode("#ffd8a8", "#e8590c", 2, "dashed"),
    io: rectNode("#e3fafc", "#0c8599"),
    subprocess: rectNode("#d3f9d8", "#40c057"),
    default: rectNode("#d0bfff", "#7048e8"),
  },
  defaultNode: DEFAULT_NODE,
};

// ── Architecture template ────────────────────────────────────────────────────

const ARCHITECTURE_TEMPLATE: TemplateDefinition = {
  name: "architecture",
  nodes: {
    service: rectNode("#d0bfff", "#7048e8"),
    api: rectNode("#d0bfff", "#7048e8"),
    db: rectNode("#b2f2bb", "#2f9e44"),
    database: rectNode("#b2f2bb", "#2f9e44"),
    queue: rectNode("#fff3bf", "#fab005"),
    cache: rectNode("#ffe8cc", "#fd7e14"),
    storage: rectNode("#ffec99", "#f08c00"),
    frontend: rectNode("#a5d8ff", "#1971c2"),
    gateway: rectNode("#ffa8a8", "#c92a2a", 3),
    orchestrator: rectNode("#ffa8a8", "#c92a2a", 3),
    user: ellipseNode("#e7f5ff", "#1971c2"),
    actor: ellipseNode("#e7f5ff", "#1971c2"),
    external: rectNode("#ffc9c9", "#e03131"),
    monitor: rectNode("#d3f9d8", "#40c057"),
    ml: rectNode("#e599f7", "#9c36b5"),
    ai: rectNode("#e599f7", "#9c36b5"),
    default: rectNode("#d0bfff", "#7048e8"),
  },
  defaultNode: DEFAULT_NODE,
};

// ── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, TemplateDefinition>([
  ["flowchart", FLOWCHART_TEMPLATE],
  ["architecture", ARCHITECTURE_TEMPLATE],
]);

export function getTemplate(name: string): TemplateDefinition {
  const tmpl = registry.get(name);
  if (!tmpl) {
    throw new Error(
      `Unknown template: "${name}". Available: ${[...registry.keys()].join(", ")}`
    );
  }
  return tmpl;
}

export function registerTemplate(
  name: string,
  template: TemplateDefinition
): void {
  registry.set(name, template);
}

export function getNodeDef(
  template: TemplateDefinition,
  nodeType: string
): TemplateNodeDef {
  return template.nodes[nodeType] ?? template.defaultNode;
}
