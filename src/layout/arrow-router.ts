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

/** Stagger anchor for N arrows sharing the same edge of a node. */
function staggerAnchor(
  node: LayoutNode,
  side: EdgeSide,
  index: number,
  total: number
): EdgeAnchor {
  if (total <= 1) {
    return getEdgeAnchor(node, side);
  }

  const pct = 0.2 + (0.6 * index) / (total - 1);

  if (side === "top" || side === "bottom") {
    // Stagger horizontally along the top/bottom edge
    const x = node.x + node.width * pct;
    const y = side === "bottom" ? node.y + node.height : node.y;
    return { x, y, side, fixedPoint: [pct, FIXED_POINTS[side][1]] };
  }

  // Left/right exits: stagger vertically along the edge
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

// ── Obstacle avoidance ───────────────────────────────────────────────────────

const OBSTACLE_PAD = 20;

/**
 * Post-process elbow points so vertical segments don't cross through
 * intermediate nodes. When a vertical segment intersects a node, a
 * horizontal detour is inserted around the obstacle.
 */
function avoidObstacles(
  relPoints: [number, number][],
  sourceAnchor: EdgeAnchor,
  allNodes: LayoutNode[],
  sourceId: string,
  targetId: string
): [number, number][] {
  const excludeIds = new Set([sourceId, targetId]);
  const obstacles = allNodes.filter((n) => !excludeIds.has(n.id));
  if (obstacles.length === 0) return relPoints;

  const toAbs = (p: [number, number]): [number, number] => [
    sourceAnchor.x + p[0],
    sourceAnchor.y + p[1],
  ];
  const toRel = (p: [number, number]): [number, number] => [
    p[0] - sourceAnchor.x,
    p[1] - sourceAnchor.y,
  ];

  const abs = relPoints.map(toAbs);
  const result: [number, number][] = [abs[0]];

  for (let i = 0; i < abs.length - 1; i++) {
    const [x1, y1] = abs[i];
    const [x2, y2] = abs[i + 1];

    const isVertical = Math.abs(x2 - x1) < 2;
    if (isVertical) {
      const segX = x1;
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      const goingDown = y2 > y1;

      // Find nodes whose padded bounding box is crossed by this vertical segment
      const blockers = obstacles.filter(
        (n) =>
          segX > n.x - OBSTACLE_PAD &&
          segX < n.x + n.width + OBSTACLE_PAD &&
          maxY > n.y &&
          minY < n.y + n.height
      );

      if (blockers.length > 0) {
        // Combined bounding box of all blockers on this segment
        const bLeft = Math.min(...blockers.map((n) => n.x));
        const bRight = Math.max(...blockers.map((n) => n.x + n.width));
        const bTop = Math.min(...blockers.map((n) => n.y));
        const bBottom = Math.max(...blockers.map((n) => n.y + n.height));

        // Detour left or right — pick the closer clear side
        const leftX = bLeft - OBSTACLE_PAD;
        const rightX = bRight + OBSTACLE_PAD;
        const detourX =
          Math.abs(segX - leftX) <= Math.abs(segX - rightX) ? leftX : rightX;

        // Enter detour before the blocker, exit after it
        const enterY = goingDown
          ? Math.max(y1, bTop - OBSTACLE_PAD)
          : Math.min(y1, bBottom + OBSTACLE_PAD);
        const exitY = goingDown
          ? Math.min(y2, bBottom + OBSTACLE_PAD)
          : Math.max(y2, bTop - OBSTACLE_PAD);

        result.push([segX, enterY]);
        result.push([detourX, enterY]);
        result.push([detourX, exitY]);
        result.push([segX, exitY]);
        result.push(abs[i + 1]);
        continue;
      }
    }

    result.push(abs[i + 1]);
  }

  return result.map(toRel);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Route an elbow arrow from source → target nodes.
 *
 * @param sourceEdgeIndex  0-based index of this arrow among all arrows sharing the same source edge
 * @param totalFromSource  total count of arrows leaving from the same edge of source
 * @param targetEdgeIndex  0-based index of this arrow among all arrows arriving at the same target edge
 * @param totalToTarget    total count of arrows arriving at the same edge of target
 * @param allNodes         all layout nodes — used for obstacle avoidance
 */
export function routeArrow(
  source: LayoutNode,
  target: LayoutNode,
  sourceEdgeIndex = 0,
  totalFromSource = 1,
  targetEdgeIndex = 0,
  totalToTarget = 1,
  allNodes: LayoutNode[] = []
): ArrowRoute {
  const { sourceSide, targetSide } = chooseSides(source, target);

  const sourceAnchor = staggerAnchor(source, sourceSide, sourceEdgeIndex, totalFromSource);
  const targetAnchor = staggerAnchor(target, targetSide, targetEdgeIndex, totalToTarget);

  let points = buildElbowPoints(sourceAnchor, targetAnchor);

  if (allNodes.length > 0) {
    points = avoidObstacles(points, sourceAnchor, allNodes, source.id, target.id);
  }

  const { width, height } = boundingBox(points);

  return { sourceAnchor, targetAnchor, points, width, height };
}
