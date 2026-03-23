import { describe, it, expect } from "vitest";
import { layoutDAG } from "../src/layout/dag.js";
import { layoutGrid } from "../src/layout/grid.js";
import type { Diagram } from "../src/types/index.js";

function makeDiagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    type: "flowchart",
    nodes: [
      { id: "start", label: "Start" },
      { id: "process", label: "Process" },
      { id: "end", label: "End" },
    ],
    edges: [
      { from: "start", to: "process" },
      { from: "process", to: "end" },
    ],
    ...overrides,
  };
}

describe("DAG layout", () => {
  it("assigns correct levels to linear chain", () => {
    const nodes = layoutDAG(makeDiagram());
    const levels = Object.fromEntries(nodes.map((n) => [n.id, n.level]));
    expect(levels["start"]).toBe(0);
    expect(levels["process"]).toBe(1);
    expect(levels["end"]).toBe(2);
  });

  it("assigns all root nodes to level 0", () => {
    const diagram = makeDiagram({
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      edges: [
        { from: "a", to: "c" },
        { from: "b", to: "c" },
      ],
    });
    const nodes = layoutDAG(diagram);
    const levels = Object.fromEntries(nodes.map((n) => [n.id, n.level]));
    expect(levels["a"]).toBe(0);
    expect(levels["b"]).toBe(0);
    expect(levels["c"]).toBe(1);
  });

  it("produces unique x positions for nodes at same level", () => {
    const diagram = makeDiagram({
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      edges: [
        { from: "a", to: "c" },
        { from: "b", to: "c" },
      ],
    });
    const nodes = layoutDAG(diagram);
    const level0 = nodes.filter((n) => n.level === 0);
    const xs = level0.map((n) => n.x);
    expect(new Set(xs).size).toBe(xs.length);
  });

  it("returns empty array for empty diagram", () => {
    const result = layoutDAG({ type: "flowchart", nodes: [], edges: [] });
    expect(result).toHaveLength(0);
  });

  it("does not hang on cyclic input — cycle nodes placed after DAG", () => {
    // A → B → C → B is a cycle; this call must terminate
    const diagram: Diagram = {
      type: "architecture",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "b" },
      ],
    };
    const nodes = layoutDAG(diagram);
    expect(nodes).toHaveLength(3);
    // A is a root (level 0), B and C come after
    const levels = Object.fromEntries(nodes.map((n) => [n.id, n.level]));
    expect(levels["a"]).toBe(0);
    expect(levels["b"]).toBeGreaterThanOrEqual(1);
  });

  it("auto-sizes a tall-label node to more than default height", () => {
    const diagram: Diagram = {
      type: "flowchart",
      nodes: [{ id: "n", label: "Line 1\nLine 2\nLine 3\nLine 4" }],
      edges: [],
    };
    const nodes = layoutDAG(diagram);
    expect(nodes[0].height).toBeGreaterThan(80);
  });

  it("is deterministic — same input produces identical output", () => {
    const diagram = makeDiagram();
    const a = layoutDAG(diagram);
    const b = layoutDAG(diagram);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("Grid layout", () => {
  it("arranges nodes in sqrt(n) columns", () => {
    const diagram = makeDiagram({
      nodes: Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, label: `N${i}` })),
      edges: [],
    });
    const nodes = layoutGrid(diagram);
    const cols = new Set(nodes.map((n) => n.colIndex));
    expect(cols.size).toBe(3); // ceil(sqrt(9)) = 3
  });

  it("returns empty array for empty diagram", () => {
    const result = layoutGrid({ type: "flowchart", nodes: [], edges: [] });
    expect(result).toHaveLength(0);
  });
});
