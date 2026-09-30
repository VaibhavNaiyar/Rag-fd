import { describe, expect, it } from "vitest";
import { nextSort, sortRows, type Column } from "./DataTable";

interface Turn {
  id: string;
  ttft: number | null;
  status: string;
}

const COLUMNS: Column<Turn>[] = [
  { id: "id", header: "Turn", cell: (row) => row.id, sortValue: (row) => row.id },
  { id: "ttft", header: "TTFT", cell: (row) => row.ttft, sortValue: (row) => row.ttft },
  { id: "status", header: "Status", cell: (row) => row.status },
];

const ROWS: Turn[] = [
  { id: "t10", ttft: 900, status: "complete" },
  { id: "t2", ttft: null, status: "error" },
  { id: "t1", ttft: 1200, status: "complete" },
  { id: "t3", ttft: 900, status: "complete" },
];

describe("nextSort", () => {
  it("cycles ascending, descending, none", () => {
    const first = nextSort(null, "ttft");
    expect(first).toEqual({ columnId: "ttft", direction: "ascending" });
    const second = nextSort(first, "ttft");
    expect(second).toEqual({ columnId: "ttft", direction: "descending" });
    expect(nextSort(second, "ttft")).toBeNull();
  });

  it("starts a different column at ascending", () => {
    expect(nextSort({ columnId: "id", direction: "descending" }, "ttft")).toEqual({ columnId: "ttft", direction: "ascending" });
  });
});

describe("sortRows", () => {
  it("leaves the order alone when there is no sort, and never mutates its input", () => {
    const copy = [...ROWS];
    expect(sortRows(ROWS, COLUMNS, null).map((row) => row.id)).toEqual(["t10", "t2", "t1", "t3"]);
    expect(ROWS).toEqual(copy);
  });

  it("orders text with numeric awareness: t2 before t10", () => {
    expect(sortRows(ROWS, COLUMNS, { columnId: "id", direction: "ascending" }).map((row) => row.id)).toEqual(["t1", "t2", "t3", "t10"]);
    expect(sortRows(ROWS, COLUMNS, { columnId: "id", direction: "descending" }).map((row) => row.id)).toEqual(["t10", "t3", "t2", "t1"]);
  });

  it("orders numbers as numbers, keeps equal values in their original order, and puts missing values last either way", () => {
    expect(sortRows(ROWS, COLUMNS, { columnId: "ttft", direction: "ascending" }).map((row) => row.id)).toEqual(["t10", "t3", "t1", "t2"]);
    expect(sortRows(ROWS, COLUMNS, { columnId: "ttft", direction: "descending" }).map((row) => row.id)).toEqual(["t1", "t10", "t3", "t2"]);
  });

  it("does not sort by a column that has no sort value", () => {
    expect(sortRows(ROWS, COLUMNS, { columnId: "status", direction: "ascending" }).map((row) => row.id)).toEqual(["t10", "t2", "t1", "t3"]);
    expect(sortRows(ROWS, COLUMNS, { columnId: "nope", direction: "ascending" })).toHaveLength(4);
  });
});
