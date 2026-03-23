import { describe, it, expect } from "vitest";
import { parse } from "../src/parser/index.js";
import { validate } from "../src/validator/index.js";
import { normalize } from "../src/normalizer/index.js";
import { getTemplate } from "../src/templates/index.js";
import { applyThemeToTemplate } from "../src/templates/themes.js";
import { layoutDAG } from "../src/layout/dag.js";
import { render } from "../src/renderer/index.js";
import type { Diagram } from "../src/types/index.js";

const SAMPLE_INPUT = JSON.stringify({
  type: "flowchart",
  nodes: [
    { id: "user", label: "User", type: "start" },
    { id: "api", label: "API", type: "process" },
    { id: "db", label: "Database", type: "process" },
  ],
  edges: [
    { from: "user", to: "api" },
    { from: "api", to: "db" },
  ],
});

function runPipeline(input: string) {
  const diagram = parse(input);
  const { diagram: normal } = normalize(diagram);
  const layout = layoutDAG(normal);
  const template = applyThemeToTemplate(getTemplate("flowchart"), "default");
  return render(normal, layout, template);
}

describe("renderer", () => {
  it("produces an element for each node plus text element (2 per node)", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    const shapeEls = elements.filter((e) => e.type === "rectangle" || e.type === "ellipse");
    const textEls = elements.filter((e) => e.type === "text" && e.containerId !== null);
    expect(shapeEls.length).toBe(3);
    expect(textEls.length).toBe(3);
  });

  it("every shape has a corresponding text element", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    const byId = new Map(elements.map((e) => [e.id, e]));
    const shapes = elements.filter((e) => e.type === "rectangle" || e.type === "ellipse");
    for (const shape of shapes) {
      expect(shape.boundElements).not.toBeNull();
      const textBinding = shape.boundElements!.find((b) => b.type === "text");
      expect(textBinding).toBeDefined();
      expect(byId.has(textBinding!.id)).toBe(true);
    }
  });

  it("produces arrow elements for edges", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    const arrows = elements.filter((e) => e.type === "arrow");
    expect(arrows.length).toBe(2);
  });

  it("all arrows have elbowed=true", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    const arrows = elements.filter((e) => e.type === "arrow") as Array<{ elbowed: boolean }>;
    for (const arrow of arrows) {
      expect(arrow.elbowed).toBe(true);
    }
  });

  it("all arrows have roughness=0 and roundness=null", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    const arrows = elements.filter((e) => e.type === "arrow");
    for (const arrow of arrows) {
      expect(arrow.roughness).toBe(0);
      expect(arrow.roundness).toBeNull();
    }
  });

  it("no element uses type=diamond", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    expect(elements.every((e) => e.type !== "diamond" as string)).toBe(true);
  });

  it("all element IDs are unique", () => {
    const elements = runPipeline(SAMPLE_INPUT);
    const ids = elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("determinism", () => {
  it("produces identical output for the same input (run twice)", () => {
    const a = runPipeline(SAMPLE_INPUT);
    const b = runPipeline(SAMPLE_INPUT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces identical output regardless of JSON key order in input", () => {
    // Reorder keys in input JSON
    const diagram: Diagram = {
      type: "flowchart",
      edges: [{ from: "a", to: "b" }],
      nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    };
    const { diagram: normal } = normalize(diagram);
    const layout1 = layoutDAG(normal);
    const layout2 = layoutDAG(normal);
    expect(JSON.stringify(layout1)).toBe(JSON.stringify(layout2));
  });
});
