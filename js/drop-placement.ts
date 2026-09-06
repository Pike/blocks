export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface IndexedRect {
  index: number;
  rect: Rect;
}

export type Placement =
  | { kind: "empty-cluster" }
  | {
      kind: "insert";
      targetIndex: number;
      position: "beforebegin" | "afterend";
    }
  | {
      kind: "new-block";
      anchorIndex: number | null;
      position: "beforebegin" | "afterend";
    };

export interface TileIdentity {
  value: string;
  color: string;
}

function overlapsX(a: Rect, b: Rect): boolean {
  return a.left <= b.right && b.left <= a.right;
}

function insertPosition(
  dropRect: Rect,
  targetRect: Rect,
): "beforebegin" | "afterend" {
  return dropRect.left > targetRect.left ? "afterend" : "beforebegin";
}

/**
 * Decide where a dropped tile lands among the sibling tiles of its
 * drop zone. `tiles` must be in document order. Pure function extracted
 * from the interact.js-driven bisection/scan that used to live inline in
 * `Tile.maybeDrop`.
 */
export function resolvePlacement(
  dropRect: Rect,
  tiles: IndexedRect[],
): Placement {
  if (tiles.length === 0) {
    return { kind: "empty-cluster" };
  }
  const cy = dropRect.top + (dropRect.bottom - dropRect.top) / 2;

  let candidates = tiles;
  let exactMatch: IndexedRect | undefined;

  while (candidates.length > 3) {
    const pivot = Math.floor(candidates.length / 2);
    const node = candidates[pivot];
    const r = node.rect;
    if (cy < r.top) {
      candidates = candidates.slice(0, pivot);
      continue;
    }
    if (cy > r.bottom) {
      candidates = candidates.slice(pivot + 1);
      continue;
    }
    if (overlapsX(r, dropRect)) {
      exactMatch = node;
      break;
    }
    if (r.right <= dropRect.left) {
      candidates = candidates.slice(pivot);
    } else {
      candidates = candidates.slice(0, pivot + 1);
    }
  }

  let before: IndexedRect | undefined;
  let maybeAfter: IndexedRect | undefined = candidates[candidates.length - 1];

  if (!exactMatch) {
    for (const node of candidates) {
      const r = node.rect;
      if (cy < r.top) {
        before = node;
        break;
      }
      if (r.top <= cy && cy <= r.bottom) {
        if (overlapsX(r, dropRect)) {
          exactMatch = node;
          break;
        }
        if (r.right < dropRect.left) {
          maybeAfter = node;
        }
        if (dropRect.right < r.left) {
          before = node;
          break;
        }
      }
      if (dropRect.top > r.bottom) {
        maybeAfter = node;
      }
    }
  }

  if (exactMatch) {
    return {
      kind: "insert",
      targetIndex: exactMatch.index,
      position: insertPosition(dropRect, exactMatch.rect),
    };
  }

  const anchor = before || maybeAfter;
  return {
    kind: "new-block",
    anchorIndex: anchor ? anchor.index : null,
    position: before ? "beforebegin" : "afterend",
  };
}

/**
 * A run (same color, consecutive values) must split into two clusters when
 * the tile that used to sit between `prev` and `next` is pulled out,
 * since `prev` and `next` are no longer consecutive.
 */
export function shouldSplitCluster(
  prev: TileIdentity,
  next: TileIdentity,
): boolean {
  return prev.color === next.color && prev.value !== next.value;
}
