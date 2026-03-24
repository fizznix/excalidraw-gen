import { describe, it, expect } from "vitest";
import { routeArrow } from "../src/layout/arrow-router.js";
import type { LayoutNode } from "../src/types/index.js";

function makeNode(id: string, x: number, y: number): LayoutNode {
  return {
    id, label: id, type: "process",
    x, y, width: 180, height: 80, level: 0, colIndex: 0,
  };
}

describe("arrow router", () => {
  it("routes vertical (bottom to top) connection", () => {
    const source = makeNode("a", 80, 80);
    const target = makeNode("b", 80, 310); // directly below
    const route = routeArrow(source, target);
    expect(route.sourceAnchor.side).toBe("bottom");
    expect(route.targetAnchor.side).toBe("top");
    expect(route.points[0]).toEqual([0, 0]);
  });

  it("routes horizontal (right to left) connection", () => {
    const source = makeNode("a", 80, 80);
    const target = makeNode("b", 420, 80); // same row, to the right
    const route = routeArrow(source, target);
    expect(route.sourceAnchor.side).toBe("right");
    expect(route.targetAnchor.side).toBe("left");
  });

  it("first point is always [0, 0]", () => {
    const source = makeNode("a", 100, 100);
    const target = makeNode("b", 400, 350);
    const route = routeArrow(source, target);
    expect(route.points[0]).toEqual([0, 0]);
  });

  it("bounding box width = max(abs(point[0]))", () => {
    const source = makeNode("a", 80, 80);
    const target = makeNode("b", 80, 310);
    const route = routeArrow(source, target);
    const expectedW = Math.max(...route.points.map(([x]) => Math.abs(x)));
    expect(route.width).toBe(Math.max(expectedW, 1));
  });

  it("bounding box height = max(abs(point[1]))", () => {
    const source = makeNode("a", 80, 80);
    const target = makeNode("b", 80, 310);
    const route = routeArrow(source, target);
    const expectedH = Math.max(...route.points.map(([, y]) => Math.abs(y)));
    expect(route.height).toBe(Math.max(expectedH, 1));
  });

  it("staggered bottom-exit arrows spread horizontally along the edge", () => {
    const source = makeNode("a", 80, 80);
    const t1 = makeNode("b1", 80, 310);
    const t2 = makeNode("b2", 300, 310);
    const r1 = routeArrow(source, t1, 0, 2);
    const r2 = routeArrow(source, t2, 1, 2);
    // With 2 arrows from bottom, they stagger at 20% and 80% of node width
    expect(r1.sourceAnchor.x).not.toBe(r2.sourceAnchor.x);
    expect(r1.sourceAnchor.x).toBeLessThan(r2.sourceAnchor.x);
    expect(r1.sourceAnchor.side).toBe("bottom");
    expect(r2.sourceAnchor.side).toBe("bottom");
  });
});
