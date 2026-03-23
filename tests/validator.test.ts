import { describe, it, expect } from "vitest";
import { validate } from "../src/validator/index.js";
import type { Diagram } from "../src/types/index.js";

function makeDiagram(overrides: Partial<Diagram> = {}): Diagram {
  return {
    type: "flowchart",
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ from: "a", to: "b" }],
    ...overrides,
  };
}

describe("validator", () => {
  it("passes a valid diagram", () => {
    const result = validate(makeDiagram());
    expect(result.errors).toHaveLength(0);
  });

  it("errors on empty nodes", () => {
    const result = validate(makeDiagram({ nodes: [], edges: [] }));
    expect(result.errors).toContain("Diagram must have at least one node");
  });

  it("errors on duplicate node IDs", () => {
    const result = validate(
      makeDiagram({
        nodes: [
          { id: "a", label: "A" },
          { id: "a", label: "A2" },
        ],
      })
    );
    expect(result.errors.some((e) => e.includes('Duplicate node ID: "a"'))).toBe(true);
  });

  it("errors on edge referencing non-existent from node", () => {
    const result = validate(
      makeDiagram({
        edges: [{ from: "x", to: "b" }],
      })
    );
    expect(result.errors.some((e) => e.includes('"x"'))).toBe(true);
  });

  it("errors on edge referencing non-existent to node", () => {
    const result = validate(
      makeDiagram({
        edges: [{ from: "a", to: "z" }],
      })
    );
    expect(result.errors.some((e) => e.includes('"z"'))).toBe(true);
  });

  it("errors on self-loop (prevents preflight crash)", () => {
    const result = validate(
      makeDiagram({
        edges: [{ from: "a", to: "a" }],
      })
    );
    expect(result.errors.some((e) => e.includes('"a"'))).toBe(true);
  });

  it("warns on cycle in flowchart", () => {
    const result = validate(
      makeDiagram({
        nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
        edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
      })
    );
    expect(result.warnings.some((w) => w.includes("Cycle"))).toBe(true);
  });

  it("warns on disconnected node", () => {
    const result = validate(
      makeDiagram({
        nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
        edges: [{ from: "a", to: "b" }],
      })
    );
    expect(result.warnings.some((w) => w.includes('"c"') && w.includes("disconnected"))).toBe(true);
  });

  it("errors when node count exceeds default max (200)", () => {
    const nodes = Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));
    const result = validate(makeDiagram({ nodes, edges: [] }));
    expect(result.errors.some((e) => e.includes("201") && e.includes("200"))).toBe(true);
  });

  it("respects custom maxNodes option", () => {
    const nodes = Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));
    const result = validate(makeDiagram({ nodes, edges: [] }), { maxNodes: 10 });
    expect(result.errors.some((e) => e.includes("11") && e.includes("10"))).toBe(true);
  });
});
