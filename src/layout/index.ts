import type { Diagram, LayoutNode, LayoutType } from "../types/index.js";
import { layoutDAG } from "./dag.js";
import { layoutGrid } from "./grid.js";

type LayoutFn = (diagram: Diagram) => LayoutNode[];

const registry = new Map<string, LayoutFn>([
  ["dag", layoutDAG],
  ["grid", layoutGrid],
]);

export function registerLayoutEngine(name: string, fn: LayoutFn): void {
  registry.set(name, fn);
}

export function runLayout(diagram: Diagram, type: LayoutType): LayoutNode[] {
  const fn = registry.get(type);
  if (!fn) {
    throw new Error(
      `Unknown layout type: "${type}". Available: ${[...registry.keys()].join(", ")}`
    );
  }
  return fn(diagram);
}
