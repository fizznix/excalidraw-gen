import type {
  Diagram,
  LayoutNode,
  LayoutEdge,
  TemplateDefinition,
  ExcalidrawElement,
  ExcalidrawBoundElement,
} from "../types/index.js";
import { getNodeDef } from "../templates/index.js";
import { routeArrow, VERTICAL_THRESHOLD } from "../layout/arrow-router.js";
import {
  createShapeElements,
  createArrowElement,
  createArrowLabel,
} from "./elements.js";

export function render(
  diagram: Diagram,
  layoutNodes: LayoutNode[],
  template: TemplateDefinition
): ExcalidrawElement[] {
  const elements: ExcalidrawElement[] = [];

  // Build nodeMap for O(1) lookup
  const nodeMap = new Map<string, LayoutNode>(layoutNodes.map((n) => [n.id, n]));

  // Build shape elements (shape + text pairs)
  for (const layoutNode of layoutNodes) {
    const nodeDef = getNodeDef(template, layoutNode.type);
    const [shapeEl, textEl] = createShapeElements(layoutNode, nodeDef);
    elements.push(shapeEl, textEl);
  }

  // Build edge list with stagger counting
  const layoutEdges: LayoutEdge[] = diagram.edges.map((e) => ({
    from: e.from,
    to: e.to,
    label: e.label,
    bidirectional: e.bidirectional,
    style: e.style,
  }));

  // Group edges by (from, sourceSide) to count stagger per edge group.
  // We pre-route to determine source side, then re-route with stagger index.
  // Simpler approach: group by source node + side determined by target position.
  type EdgeGroup = { edge: LayoutEdge; index: number; total: number };
  const edgeGroups = new Map<string, LayoutEdge[]>();
  for (const edge of layoutEdges) {
    const key = edge.from;
    if (!edgeGroups.has(key)) edgeGroups.set(key, []);
    edgeGroups.get(key)!.push(edge);
  }

  // Count per-side groupings (source side)
  const sideGroups = new Map<string, LayoutEdge[]>();
  // Also group by target side for staggering incoming arrows
  const targetSideGroups = new Map<string, LayoutEdge[]>();

  for (const [fromId, edges] of edgeGroups) {
    const source = nodeMap.get(fromId);
    if (!source) continue;
    for (const edge of edges) {
      const target = nodeMap.get(edge.to);
      if (!target) continue;
      // Determine side using the same threshold as the arrow router
      const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
      const dy = (target.y + target.height / 2) - (source.y + source.height / 2);
      const sourceSide =
        Math.abs(dy) > VERTICAL_THRESHOLD
          ? dy > 0 ? "bottom" : "top"
          : dx >= 0 ? "right" : "left";
      const targetSide =
        Math.abs(dy) > VERTICAL_THRESHOLD
          ? dy > 0 ? "top" : "bottom"
          : dx >= 0 ? "left" : "right";

      const sideKey = `${fromId}:${sourceSide}`;
      if (!sideGroups.has(sideKey)) sideGroups.set(sideKey, []);
      sideGroups.get(sideKey)!.push(edge);

      const tKey = `${edge.to}:${targetSide}`;
      if (!targetSideGroups.has(tKey)) targetSideGroups.set(tKey, []);
      targetSideGroups.get(tKey)!.push(edge);
    }
  }

  // Render arrows + collect arrow bindings per shape
  const arrowBindings = new Map<string, ExcalidrawBoundElement[]>();

  for (const [sideKey, sideEdges] of sideGroups) {
    const fromId = sideKey.split(":")[0];
    const source = nodeMap.get(fromId);
    if (!source) continue;

    sideEdges.forEach((edge, i) => {
      const target = nodeMap.get(edge.to);
      if (!target) return;

      // Look up target-side stagger info
      const dx = (target.x + target.width / 2) - (source.x + source.width / 2);
      const dy = (target.y + target.height / 2) - (source.y + source.height / 2);
      const targetSide =
        Math.abs(dy) > VERTICAL_THRESHOLD
          ? dy > 0 ? "top" : "bottom"
          : dx >= 0 ? "left" : "right";
      const tKey = `${edge.to}:${targetSide}`;
      const tGroup = targetSideGroups.get(tKey) ?? [edge];
      const tIndex = tGroup.indexOf(edge);

      const route = routeArrow(source, target, i, sideEdges.length, Math.max(0, tIndex), tGroup.length, layoutNodes);

      // Arrow stroke = target node's stroke color
      const targetTemplate = getNodeDef(template, target.type);
      const strokeColor = targetTemplate.style.strokeColor;

      const arrowEl = createArrowElement(edge, route, strokeColor);
      elements.push(arrowEl);
      if (edge.label) {
        elements.push(createArrowLabel(edge, route));
      }

      // Track which arrows bind to each shape
      const arrowRef: ExcalidrawBoundElement = { type: "arrow", id: arrowEl.id };
      if (!arrowBindings.has(edge.from)) arrowBindings.set(edge.from, []);
      arrowBindings.get(edge.from)!.push(arrowRef);
      if (!arrowBindings.has(edge.to)) arrowBindings.set(edge.to, []);
      arrowBindings.get(edge.to)!.push(arrowRef);
    });
  }

  // Patch shape boundElements to include their connected arrows
  for (const el of elements) {
    if ((el.type === "rectangle" || el.type === "ellipse") && arrowBindings.has(el.id)) {
      const existing = el.boundElements ?? [];
      (el as any).boundElements = [...existing, ...arrowBindings.get(el.id)!];
    }
  }

  return elements;
}
