import { describe, expect, it } from "vitest";
import {
  resolvePlacement,
  shouldSplitCluster,
  type IndexedRect,
  type Rect,
} from "./drop-placement";

function rect(left: number, top: number, width = 40, height = 50): Rect {
  return { top, bottom: top + height, left, right: left + width };
}

function indexed(rects: Rect[]): IndexedRect[] {
  return rects.map((r, index) => ({ index, rect: r }));
}

describe("resolvePlacement", () => {
  it("returns empty-cluster when there are no sibling tiles", () => {
    expect(resolvePlacement(rect(0, 0), [])).toEqual({ kind: "empty-cluster" });
  });

  describe("<=3 tiles, exact match on the same row", () => {
    const tiles = indexed([rect(0, 0), rect(50, 0), rect(100, 0)]);

    it("inserts afterend when dropped to the right of the target", () => {
      // overlaps tile 1 (left 50..90), dropped further right than it
      const drop = rect(60, 0);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 1,
        position: "afterend",
      });
    });

    it("inserts beforebegin when dropped to the left of the target", () => {
      // overlaps tile 1, but dropped left of tile 1's own left edge
      const drop = rect(45, 0);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 1,
        position: "beforebegin",
      });
    });
  });

  describe("<=3 tiles, no exact match", () => {
    it("anchors beforebegin on the first tile below the drop point", () => {
      const tiles = indexed([rect(0, 0), rect(0, 60)]);
      // above both rows
      const drop = rect(0, -100);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "new-block",
        anchorIndex: 0,
        position: "beforebegin",
      });
    });

    it("anchors beforebegin on a same-row tile entirely to the right", () => {
      const tiles = indexed([rect(0, 0), rect(200, 0)]);
      const drop = rect(100, 0); // same row, right of tile 0, left of tile 1
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "new-block",
        anchorIndex: 1,
        position: "beforebegin",
      });
    });

    it("anchors afterend on the last tile above/left of the drop point when nothing follows", () => {
      const tiles = indexed([rect(0, 0), rect(50, 0)]);
      // below both, to the right
      const drop = rect(200, 200);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "new-block",
        anchorIndex: 1,
        position: "afterend",
      });
    });

    it("never returns a null anchor when tiles are present", () => {
      const tiles = indexed([rect(0, 0)]);
      const drop = rect(500, 500);
      const placement = resolvePlacement(drop, tiles);
      expect(placement.kind).toBe("new-block");
      expect(
        (placement as { anchorIndex: number | null }).anchorIndex,
      ).not.toBeNull();
    });
  });

  describe(">3 tiles, bisection narrowing", () => {
    it("narrows upward (cy above candidate row) and keeps searching the earlier half", () => {
      // 5 tiles: row0 has 2, row1 has 3. pivot = floor(5/2) = 2 -> first tile of row1.
      const tiles = indexed([
        rect(0, 0),
        rect(50, 0),
        rect(0, 60),
        rect(50, 60),
        rect(100, 60),
      ]);
      // drop is on row0, above the pivot candidate (row1) -> narrows to [0,1]
      const drop = rect(60, 0);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 1,
        position: "afterend",
      });
    });

    it("narrows downward (cy below candidate row) and keeps searching the later half", () => {
      // 5 tiles: row0 has 3, row1 has 2. pivot = 2 -> last tile of row0.
      const tiles = indexed([
        rect(0, 0),
        rect(50, 0),
        rect(100, 0),
        rect(0, 60),
        rect(50, 60),
      ]);
      // drop is on row1, below the pivot candidate (row0) -> narrows to [3,4]
      const drop = rect(60, 60);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 4,
        position: "afterend",
      });
    });

    it("narrows leftward on a same row when candidate is right of the drop", () => {
      // 5 tiles on one row, evenly spaced. pivot = 2.
      const tiles = indexed([
        rect(0, 0),
        rect(50, 0),
        rect(100, 0),
        rect(150, 0),
        rect(200, 0),
      ]);
      // drop overlaps tile 0 only; pivot candidate (index 2) is entirely right of it
      const drop = rect(5, 0);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 0,
        position: "afterend",
      });
    });

    it("narrows rightward on a same row when candidate is left of the drop", () => {
      const tiles = indexed([
        rect(0, 0),
        rect(50, 0),
        rect(100, 0),
        rect(150, 0),
        rect(200, 0),
      ]);
      // drop overlaps tile 4 only; pivot candidate (index 2) is entirely left of it
      const drop = rect(205, 0);
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 4,
        position: "afterend",
      });
    });

    it("finds an exact match on the pivot candidate itself, mid-bisection", () => {
      const tiles = indexed([
        rect(0, 0),
        rect(50, 0),
        rect(100, 0),
        rect(150, 0),
        rect(200, 0),
      ]);
      const drop = rect(105, 0); // overlaps pivot candidate (index 2) directly
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "insert",
        targetIndex: 2,
        position: "afterend",
      });
    });

    it("falls back to the linear scan once narrowed to 3 or fewer candidates", () => {
      // 4 tiles on one row; pivot = 2, narrows to 3, then linear scan finds the gap.
      const tiles = indexed([
        rect(0, 0),
        rect(50, 0),
        rect(100, 0),
        rect(150, 0),
      ]);
      const drop = rect(500, 0); // right of everything, same row
      expect(resolvePlacement(drop, tiles)).toEqual({
        kind: "new-block",
        anchorIndex: 3,
        position: "afterend",
      });
    });
  });
});

describe("shouldSplitCluster", () => {
  it("splits a run when colors match but values differ", () => {
    expect(
      shouldSplitCluster(
        { color: "red", value: "3" },
        { color: "red", value: "5" },
      ),
    ).toBe(true);
  });

  it("does not split when colors and values both match", () => {
    expect(
      shouldSplitCluster(
        { color: "red", value: "3" },
        { color: "red", value: "3" },
      ),
    ).toBe(false);
  });

  it("does not split when colors differ, regardless of value", () => {
    expect(
      shouldSplitCluster(
        { color: "red", value: "3" },
        { color: "blue", value: "5" },
      ),
    ).toBe(false);
  });
});
