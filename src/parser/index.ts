import { load as yamlLoad } from "js-yaml";
import type { Diagram, DiagramType, InputNode, InputEdge, NodeStyle, EdgeStyle } from "../types/index.js";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

const VALID_DIAGRAM_TYPES: DiagramType[] = ["flowchart", "architecture"];

function looksLikeYaml(input: string): boolean {
  const t = input.trimStart();
  return t.startsWith("---") || t.startsWith("type:") || t.startsWith("nodes:");
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new ParseError(`Expected string at "${path}", got ${typeof value}`);
  }
  return value;
}

/** Parse an optional style override object — accepts any subset of NodeStyle fields */
function parseNodeStyle(raw: unknown, path: string): NodeStyle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`${path} must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const style: NodeStyle = {};
  const strFields = ["backgroundColor", "strokeColor", "strokeStyle", "fillStyle", "shape"] as const;
  for (const f of strFields) {
    if (obj[f] !== undefined) (style as Record<string, unknown>)[f] = assertString(obj[f], `${path}.${f}`);
  }
  if (obj["strokeWidth"] !== undefined) style.strokeWidth = Number(obj["strokeWidth"]);
  if (obj["width"] !== undefined) style.width = Number(obj["width"]);
  if (obj["height"] !== undefined) style.height = Number(obj["height"]);
  if (obj["opacity"] !== undefined) style.opacity = Number(obj["opacity"]);
  return style;
}

/** Parse an optional style override object — accepts any subset of EdgeStyle fields */
function parseEdgeStyle(raw: unknown, path: string): EdgeStyle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`${path} must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const style: EdgeStyle = {};
  if (obj["strokeColor"] !== undefined) style.strokeColor = assertString(obj["strokeColor"], `${path}.strokeColor`);
  if (obj["strokeStyle"] !== undefined) style.strokeStyle = assertString(obj["strokeStyle"], `${path}.strokeStyle`) as EdgeStyle["strokeStyle"];
  if (obj["strokeWidth"] !== undefined) style.strokeWidth = Number(obj["strokeWidth"]);
  if (obj["opacity"] !== undefined) style.opacity = Number(obj["opacity"]);
  return style;
}

function parseNode(raw: unknown, index: number): InputNode {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`nodes[${index}] must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const id = assertString(obj["id"], `nodes[${index}].id`).trim();
  if (!id) throw new ParseError(`nodes[${index}].id must not be empty`);
  const label = assertString(obj["label"], `nodes[${index}].label`).trim();
  const node: InputNode = { id, label };
  if (obj["type"] !== undefined) {
    node.type = assertString(obj["type"], `nodes[${index}].type`);
  }
  if (obj["metadata"] !== undefined) {
    if (typeof obj["metadata"] !== "object" || Array.isArray(obj["metadata"])) {
      throw new ParseError(`nodes[${index}].metadata must be an object`);
    }
    node.metadata = obj["metadata"] as Record<string, unknown>;
  }
  if (obj["style"] !== undefined) {
    node.style = parseNodeStyle(obj["style"], `nodes[${index}].style`);
  }
  return node;
}

function parseEdge(raw: unknown, index: number): InputEdge {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`edges[${index}] must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const from = assertString(obj["from"], `edges[${index}].from`).trim();
  if (!from) throw new ParseError(`edges[${index}].from must not be empty`);
  const to = assertString(obj["to"], `edges[${index}].to`).trim();
  if (!to) throw new ParseError(`edges[${index}].to must not be empty`);
  const edge: InputEdge = { from, to };
  if (obj["label"] !== undefined) {
    edge.label = assertString(obj["label"], `edges[${index}].label`);
  }
  if (obj["bidirectional"] !== undefined) {
    edge.bidirectional = Boolean(obj["bidirectional"]);
  }
  if (obj["style"] !== undefined) {
    edge.style = parseEdgeStyle(obj["style"], `edges[${index}].style`);
  }
  return edge;
}

function parseRaw(raw: unknown): Diagram {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError("Input must be an object at the top level");
  }

  const obj = raw as Record<string, unknown>;

  const diagramType = assertString(obj["type"], "type") as DiagramType;
  if (!VALID_DIAGRAM_TYPES.includes(diagramType)) {
    throw new ParseError(
      `Invalid diagram type "${diagramType}". Must be one of: ${VALID_DIAGRAM_TYPES.join(", ")}`
    );
  }

  if (!Array.isArray(obj["nodes"])) {
    throw new ParseError('"nodes" must be an array');
  }
  if (!Array.isArray(obj["edges"])) {
    throw new ParseError('"edges" must be an array');
  }

  const nodes = (obj["nodes"] as unknown[]).map(parseNode);
  const edges = (obj["edges"] as unknown[]).map(parseEdge);

  const diagram: Diagram = { type: diagramType, nodes, edges };

  if (obj["title"] !== undefined) {
    diagram.title = assertString(obj["title"], "title");
  }

  return diagram;
}

export function parse(input: string): Diagram {
  const trimmed = input.trim();

  if (looksLikeYaml(trimmed)) {
    let raw: unknown;
    try {
      raw = yamlLoad(trimmed);
    } catch (err) {
      throw new ParseError(
        `Invalid YAML: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return parseRaw(raw);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (err) {
    throw new ParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return parseRaw(raw);
}
