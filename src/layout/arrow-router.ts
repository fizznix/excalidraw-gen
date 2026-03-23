import type {
  LayoutNode,
  EdgeAnchor,
  EdgeSide,
  ArrowRoute,
} from "../types/index.js";

// ── Edge anchor calculation ──────────────────────────────────────────────────

const FIXED_POINTS: Record<EdgeSide, [number, number]> = {
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
};

function getEdgeAnchor(node: LayoutNode, side: EdgeSide): EdgeAnchor {
  let x: number, y: number;
  switch (side) {
    case "top":
      x = node.x + node.width / 2;
      y = node.y;
      break;
    case "bottom":
      x = node.x + node.width / 2;
      y = node.y + node.height;
      break;
    case "left":
      x = node.x;
      y = node.y + node.height / 2;
      break;
    case "right":
      x = node.x + node.width;
      y = node.y + node.height / 2;
      break;
  }
  return { x, y, side, fixedPoint: FIXED_POINTS[side] };
}

/** Stagger start anchor for N arrows leaving the same edge.
 * Only applied to left/right exits — for top/bottom, the step routing
 * pattern naturally keeps arrows distinguishable without staggering the start.
 */
function staggerAnchor(
  node: LayoutNode,
  side: EdgeSide,
  index: number,
  total: number
): EdgeAnchor {
  // Top/bottom exits: always use center — step routing handles fan-out visually
  if (side === "top" || side === "bottom" || total <= 1) {
    return getEdgeAnchor(node, side);
  }

  // Left/right exits: stagger vertically along the edge
  const pct = 0.2 + (0.6 * index) / (total - 1);
  const x = side === "right" ? node.x + node.width : node.x;
  const y = node.y + node.height * pct;

  return {
    x,
    y,
    side,
    fixedPoint: [FIXED_POINTS[side][0], pct],
  };
}

// ── Best edge selection ──────────────────────────────────────────────────────

/**
 * Minimum y-difference to consider nodes as being on different rows.
 * Matches SPACING_Y * 0.4 from the layout engine (150 * 0.4 = 60).
 * Exported so the renderer can use the same threshold for stagger grouping.
 */
export const VERTICAL_THRESHOLD = 60;

/**
 * Choose optimal source → target edge sides based on relative position.
 * Strongly prefers vertical (bottom→top / top→bottom) routing when the
 * target is in a different layout row — prevents backward/crossing arrows.
 * Only falls back to horizontal routing for same-row connections.
 */
function chooseSides(
  source: LayoutNode,
  target: LayoutNode
): { sourceSide: EdgeSide; targetSide: EdgeSide } {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;

  // Different rows: always route vertically regardless of horizontal offset.
  // This avoids backward/crossing arrows when nodes are side-by-side across rows.
  if (Math.abs(dy) > VERTICAL_THRESHOLD) {
    if (dy > 0) return { sourceSide: "bottom", targetSide: "top" };
    else return { sourceSide: "top", targetSide: "bottom" };
  }

  // Same row: route horizontally.
  if (dx > 0) return { sourceSide: "right", targetSide: "left" };
  if (dx < 0) return { sourceSide: "left", targetSide: "right" };

  // Fallback (same position — self-loop guard should have filtered this)
  return { sourceSide: "bottom", targetSide: "top" };
}

// ── Bounding box of points ───────────────────────────────────────────────────

function boundingBox(points: [number, number][]): { width: number; height: number } {
  let maxAbsX = 0;
  let maxAbsY = 0;
  for (const [px, py] of points) {
    if (Math.abs(px) > maxAbsX) maxAbsX = Math.abs(px);
    if (Math.abs(py) > maxAbsY) maxAbsY = Math.abs(py);
  }
  return { width: Math.max(maxAbsX, 1), height: Math.max(maxAbsY, 1) };
}

// ── Elbow point generation ───────────────────────────────────────────────────

function buildElbowPoints(
  sourceAnchor: EdgeAnchor,
  targetAnchor: EdgeAnchor
): [number, number][] {
  const dx = targetAnchor.x - sourceAnchor.x;
  const dy = targetAnchor.y - sourceAnchor.y;
  const sourceSide = sourceAnchor.side;

  const CLEARANCE = 50;
  // Row gap between levels is 70px — use ~half of it so the horizontal
  // segment of a step-routed arrow stays in the lane between rows,
  // not through intermediate nodes on skip-level connections.
  const ROW_CLEARANCE = 35;

  // Nearly straight lines
  if (Math.abs(dx) < 2 && (sourceSide === "top" || sourceSide === "bottom")) {
    return [[0, 0], [0, dy]];
  }
  if (Math.abs(dy) < 2 && (sourceSide === "left" || sourceSide === "right")) {
    return [[0, 0], [dx, 0]];
  }

  switch (sourceSide) {
    case "bottom":
    case "top": {
      if (targetAnchor.side === "top" || targetAnchor.side === "bottom") {
        // Step routing: exit downward/upward ROW_CLEARANCE px (into the row gap),
        // turn horizontal, then continue to target.
        // Using ROW_CLEARANCE (not halfDy) ensures the horizontal segment stays
        // just below/above the source node — skip-level arrows never cut through
        // intermediate nodes that sit at the dy/2 position.
        const exitDir = sourceSide === "bottom" ? 1 : -1;
        const exitOffset = exitDir * ROW_CLEARANCE;
        return [[0, 0], [0, exitOffset], [dx, exitOffset], [dx, dy]];
      }
      // bottom/top → left/right side: exit vertically first, then go across
      return [[0, 0], [0, dy], [dx, dy]];
    }
    case "right":
    case "left": {
      if (targetAnchor.side === "left" || targetAnchor.side === "right") {
        if (
          sourceSide === "right" &&
          targetAnchor.side === "left" &&
          targetAnchor.x > sourceAnchor.x
        ) {
          // Straight across with Y correction
          return Math.abs(dy) < 2 ? [[0, 0], [dx, 0]] : [[0, 0], [dx, 0], [dx, dy]];
        }
        // U-turn: same side or back direction
        return [
          [0, 0],
          [CLEARANCE, 0],
          [CLEARANCE, dy],
          [dx, dy],
        ];
      }
      return [[0, 0], [dx, 0], [dx, dy]];
    }
  }
  // Fallback — straight line
  return [[0, 0], [dx, dy]];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Route an elbow arrow from source → target nodes.
 *
 * @param sourceEdgeIndex  0-based index of this arrow among all arrows sharing the same source edge
 * @param totalFromSource  total count of arrows leaving from the same edge of source
 */
export function routeArrow(
  source: LayoutNode,
  target: LayoutNode,
  sourceEdgeIndex = 0,
  totalFromSource = 1
): ArrowRoute {
  const { sourceSide, targetSide } = chooseSides(source, target);

  const sourceAnchor = staggerAnchor(source, sourceSide, sourceEdgeIndex, totalFromSource);
  const targetAnchor = getEdgeAnchor(target, targetSide);

  const points = buildElbowPoints(sourceAnchor, targetAnchor);
  const { width, height } = boundingBox(points);

  return { sourceAnchor, targetAnchor, points, width, height };
}
