import type {
  ExcalidrawElement,
  ExcalidrawText,
  ExcalidrawArrow,
} from "../types/index.js";

export class PreflightError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Pre-flight validation failed:\n  • ${issues.join("\n  • ")}`);
    this.name = "PreflightError";
  }
}

function isTextEl(el: ExcalidrawElement): el is ExcalidrawText {
  return el.type === "text";
}

function isArrowEl(el: ExcalidrawElement): el is ExcalidrawArrow {
  return el.type === "arrow";
}

function arrowBoundingBox(points: [number, number][]): {
  width: number;
  height: number;
} {
  let maxAbsX = 0;
  let maxAbsY = 0;
  for (const [px, py] of points) {
    if (Math.abs(px) > maxAbsX) maxAbsX = Math.abs(px);
    if (Math.abs(py) > maxAbsY) maxAbsY = Math.abs(py);
  }
  return { width: Math.max(maxAbsX, 1), height: Math.max(maxAbsY, 1) };
}

/**
 * Strict pre-flight validation run on generated Excalidraw elements BEFORE
 * writing to file. Throws PreflightError if any issues are found.
 */
export function preflightValidate(elements: ExcalidrawElement[]): void {
  const issues: string[] = [];
  const byId = new Map<string, ExcalidrawElement>(elements.map((el) => [el.id, el]));

  // ── Unique IDs ─────────────────────────────────────────────────────────────
  const seen = new Set<string>();
  for (const el of elements) {
    if (seen.has(el.id)) issues.push(`Duplicate element ID: "${el.id}"`);
    seen.add(el.id);
  }

  // ── Shape / text binding ──────────────────────────────────────────────────
  for (const el of elements) {
    if (el.type === "rectangle" || el.type === "ellipse") {
      if (el.boundElements) {
        for (const binding of el.boundElements) {
          if (binding.type !== "text") continue;
          const textEl = byId.get(binding.id);
          if (!textEl) {
            issues.push(
              `Shape "${el.id}" references missing text element "${binding.id}"`
            );
          } else if (!isTextEl(textEl)) {
            issues.push(
              `Shape "${el.id}" bound element "${binding.id}" is not a text element`
            );
          } else if (textEl.containerId !== el.id) {
            issues.push(
              `Text "${textEl.id}" containerId "${textEl.containerId}" doesn't match shape "${el.id}"`
            );
          }
        }
      }
    }
  }

  // ── Text containerId references ──────────────────────────────────────────
  for (const el of elements) {
    if (!isTextEl(el)) continue;
    if (!el.containerId) continue; // standalone texts are fine
    const shape = byId.get(el.containerId);
    if (!shape) {
      issues.push(
        `Text "${el.id}" has containerId "${el.containerId}" which doesn't exist`
      );
    }
  }

  // ── Arrow validation ─────────────────────────────────────────────────────
  const TOLERANCE = 15;
  const shapeElements = elements.filter(
    (el) => el.type === "rectangle" || el.type === "ellipse"
  );

  /**
   * Minimum distance from (x, y) to any of the 4 edge line segments of any shape.
   * This correctly handles staggered arrows that start along an edge (not just at midpoint).
   */
  function closestEdgeDist(x: number, y: number): number {
    let minDist = Infinity;

    // Distance from point (px,py) to segment (ax,ay)→(bx,by)
    function distToSegment(
      px: number, py: number,
      ax: number, ay: number,
      bx: number, by: number
    ): number {
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
    }

    for (const shape of shapeElements) {
      const { x: sx, y: sy, width: sw, height: sh } = shape;
      const segments = [
        [sx, sy, sx + sw, sy],             // top
        [sx + sw, sy, sx + sw, sy + sh],   // right
        [sx + sw, sy + sh, sx, sy + sh],   // bottom
        [sx, sy + sh, sx, sy],             // left
      ] as const;
      for (const [ax, ay, bx, by] of segments) {
        const d = distToSegment(x, y, ax, ay, bx, by);
        if (d < minDist) minDist = d;
      }
    }
    return minDist;
  }

  for (const el of elements) {
    if (!isArrowEl(el)) continue;
    const arrow = el;

    // Elbow properties
    if (arrow.points.length > 2) {
      if (!arrow.elbowed) {
        issues.push(`Arrow "${arrow.id}" has multiple points but elbowed is not true`);
      }
      if (arrow.roundness !== null) {
        issues.push(
          `Arrow "${arrow.id}" has multiple points but roundness is not null`
        );
      }
    }

    // Bounding box check
    const { width: bw, height: bh } = arrowBoundingBox(arrow.points);
    if (arrow.width < bw - 1 || arrow.height < bh - 1) {
      issues.push(
        `Arrow "${arrow.id}" bounding box (${arrow.width}×${arrow.height}) is smaller than path (${bw}×${bh})`
      );
    }

    // Start anchor proximity to shape edge
    const startDist = closestEdgeDist(arrow.x, arrow.y);
    if (startDist > TOLERANCE) {
      issues.push(
        `Arrow "${arrow.id}" start point (${Math.round(arrow.x)},${Math.round(arrow.y)}) is ${Math.round(startDist)}px from nearest shape edge (tolerance: ${TOLERANCE}px)`
      );
    }
  }

  if (issues.length > 0) {
    throw new PreflightError(issues);
  }
}
