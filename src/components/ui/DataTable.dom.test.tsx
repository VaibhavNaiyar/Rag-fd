import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataTable, type Column, type SortState } from "./DataTable";

interface Turn {
  id: string;
  utterance: string;
  ttft: number;
  lead: number;
  cost: string;
  support: string;
  status: string;
  session: string;
}

const ROWS: Turn[] = Array.from({ length: 12 }, (_, index) => ({
  id: `t${index + 1}`,
  utterance: `Utterance number ${index + 1}`,
  ttft: 800 + index * 40,
  lead: 1200 - index * 30,
  cost: `$0.00${index + 10}`,
  support: `${90 + (index % 10)}%`,
  status: index === 3 ? "error" : "complete",
  session: "s_mock_0001",
}));

/** Eight columns, the acceptance case for 375 px: three priorities. */
const COLUMNS: Column<Turn>[] = [
  { id: "id", header: "Turn", cell: (row) => row.id, mono: true, width: "3.5rem", sortable: true, sortValue: (row) => row.id },
  { id: "utterance", header: "Utterance", cell: (row) => row.utterance, priority: 1 },
  { id: "ttft", header: "TTFT", cell: (row) => `${row.ttft} ms`, mono: true, align: "end", priority: 1, sortable: true, sortValue: (row) => row.ttft },
  { id: "lead", header: "Lead", cell: (row) => `${row.lead} ms`, mono: true, align: "end", priority: 2 },
  { id: "cost", header: "Cost", cell: (row) => row.cost, mono: true, align: "end", priority: 2 },
  { id: "support", header: "Support", cell: (row) => row.support, priority: 3 },
  { id: "status", header: "Status", cell: (row) => row.status, priority: 3 },
  { id: "session", header: "Session", cell: (row) => row.session, mono: true, priority: 3 },
];

const getRowId = (row: Turn) => row.id;

describe("DataTable: a plain table", () => {
  it("is a table named by its caption, with column headers and one row per item", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS} getRowId={getRowId} />);
    const table = screen.getByRole("table", { name: "Turns" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(within(table).getAllByRole("cell")).toHaveLength(12 * 8);
  });

  it("puts a data-label on every cell, which is what a record shows beside each value under 480 px (the reflow acceptance test)", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS.slice(0, 1)} getRowId={getRowId} />);
    const cells = within(screen.getAllByRole("row")[1] as HTMLElement).getAllByRole("cell");
    expect(cells.map((cell) => cell.getAttribute("data-label"))).toEqual(COLUMNS.map((column) => column.header));
  });

  it("marks each column's priority so the container can drop columns as it narrows", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS.slice(0, 1)} getRowId={getRowId} />);
    const priorities = screen.getAllByRole("columnheader").map((header) => header.getAttribute("data-priority"));
    expect(priorities).toEqual(["1", "1", "1", "2", "2", "3", "3", "3"]);
  });

  it("uses the monospace face and right alignment where a column asks for them", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS.slice(0, 1)} getRowId={getRowId} />);
    const cells = within(screen.getAllByRole("row")[1] as HTMLElement).getAllByRole("cell");
    expect(cells[0]).toHaveClass("font-mono");
    expect(cells[2]).toHaveAttribute("data-align", "end");
    expect(cells[1]).not.toHaveClass("font-mono");
  });

  it("gives a column its own width, and leaves the rest to share what remains", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS.slice(0, 1)} getRowId={getRowId} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]?.style.width).toBe("3.5rem");
    expect(headers[1]?.style.width).toBe("");
  });

  it("is not focusable row by row: a table that does nothing on click is not a grid", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS} getRowId={getRowId} />);
    expect(screen.queryByRole("grid")).toBeNull();
    for (const row of screen.getAllByRole("row")) expect(row).not.toHaveAttribute("tabindex");
  });

  it("draws the density it is given", () => {
    const { container, rerender } = render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS} getRowId={getRowId} />);
    expect(container.firstElementChild).toHaveAttribute("data-density", "default");
    rerender(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS} getRowId={getRowId} density="compact" />);
    expect(container.firstElementChild).toHaveAttribute("data-density", "compact");
  });
});

describe("DataTable: empty and loading", () => {
  it("says so when there are no rows", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={[]} getRowId={getRowId} emptyMessage="No turns yet." />);
    expect(screen.getByText("No turns yet.")).toBeInTheDocument();
  });

  it("marks itself busy and shows a skeleton while loading, instead of rows", () => {
    render(<DataTable caption="Turns" columns={COLUMNS} rows={ROWS} getRowId={getRowId} loading />);
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading Turns");
    expect(screen.queryByText("Utterance number 1")).toBeNull();
  });
});

describe("DataTable: sorting", () => {
  function Sorted({ onSortChange = () => undefined }: { onSortChange?: (sort: SortState | null) => void }) {
    const [sort, setSort] = useState<SortState | null>(null);
    return (
      <DataTable
        caption="Turns"
        columns={COLUMNS}
        rows={ROWS}
        getRowId={getRowId}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          onSortChange(next);
        }}
      />
    );
  }

  it("marks only sortable columns with aria-sort, none to begin with", () => {
    render(<Sorted />);
    const sortable = screen.getAllByRole("columnheader").filter((header) => header.hasAttribute("aria-sort"));
    expect(sortable.map((header) => header.textContent)).toEqual(["Turn", "TTFT"]);
    for (const header of sortable) expect(header).toHaveAttribute("aria-sort", "none");
  });

  it("cycles ascending, descending, none on a click, and reports each", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<Sorted onSortChange={onSortChange} />);
    const ttft = () => screen.getByRole("columnheader", { name: /TTFT/ });

    await user.click(within(ttft()).getByRole("button"));
    expect(ttft()).toHaveAttribute("aria-sort", "ascending");
    await user.click(within(ttft()).getByRole("button"));
    expect(ttft()).toHaveAttribute("aria-sort", "descending");
    await user.click(within(ttft()).getByRole("button"));
    expect(ttft()).toHaveAttribute("aria-sort", "none");
    expect(onSortChange.mock.calls.map((call) => call[0]?.direction ?? null)).toEqual(["ascending", "descending", null]);
  });

  it("sorts one column at a time", async () => {
    const user = userEvent.setup();
    render(<Sorted />);
    await user.click(within(screen.getByRole("columnheader", { name: /TTFT/ })).getByRole("button"));
    await user.click(within(screen.getByRole("columnheader", { name: /Turn/ })).getByRole("button"));
    expect(screen.getByRole("columnheader", { name: /TTFT/ })).toHaveAttribute("aria-sort", "none");
    expect(screen.getByRole("columnheader", { name: /Turn/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("has a header that stays in view: it is sticky (containers.css), and its buttons are real buttons", () => {
    render(<Sorted />);
    const button = within(screen.getByRole("columnheader", { name: /Turn/ })).getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveClass("dt-sort");
  });
});

describe("DataTable: keyboard grid", () => {
  function Grid({ onRowActivate = () => undefined, activeId }: { onRowActivate?: (row: Turn) => void; activeId?: string | null }) {
    return <DataTable caption="Turns" columns={COLUMNS} rows={ROWS} getRowId={getRowId} onRowActivate={onRowActivate} activeId={activeId} />;
  }
  const rowsOf = () => screen.getAllByRole("row").slice(1);

  it("becomes a grid with one tab stop", () => {
    render(<Grid />);
    expect(screen.getByRole("grid", { name: "Turns" })).toBeInTheDocument();
    expect(rowsOf().filter((row) => row.getAttribute("tabindex") === "0")).toHaveLength(1);
    expect(rowsOf()[0]).toHaveAttribute("tabindex", "0");
    expect(rowsOf()[1]).toHaveAttribute("tabindex", "-1");
    expect(within(rowsOf()[0] as HTMLElement).getAllByRole("gridcell")).toHaveLength(8);
  });

  it("moves between rows with Up and Down, and does not wrap", async () => {
    const user = userEvent.setup();
    render(<Grid />);
    rowsOf()[0]?.focus();
    await user.keyboard("{ArrowDown}");
    expect(rowsOf()[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(rowsOf()[0]).toHaveFocus();
  });

  it("goes to the first and last row with Home and End, and by ten with Page Up and Page Down", async () => {
    const user = userEvent.setup();
    render(<Grid />);
    rowsOf()[0]?.focus();
    await user.keyboard("{End}");
    expect(rowsOf()[11]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(rowsOf()[0]).toHaveFocus();
    await user.keyboard("{PageDown}");
    expect(rowsOf()[10]).toHaveFocus();
    await user.keyboard("{PageUp}");
    expect(rowsOf()[0]).toHaveFocus();
  });

  it("keeps the tab stop on the row that was last focused, so Tab returns to it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Grid />
        <button>After</button>
      </>,
    );
    rowsOf()[0]?.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(rowsOf()[2]).toHaveAttribute("tabindex", "0");
    expect(rowsOf()[0]).toHaveAttribute("tabindex", "-1");
  });

  it("opens the row with Enter, and with a click", async () => {
    const user = userEvent.setup();
    const onRowActivate = vi.fn();
    render(<Grid onRowActivate={onRowActivate} />);
    rowsOf()[2]?.focus();
    await user.keyboard("{Enter}");
    expect(onRowActivate).toHaveBeenLastCalledWith(ROWS[2]);
    await user.click(screen.getByText("Utterance number 5"));
    expect(onRowActivate).toHaveBeenLastCalledWith(ROWS[4]);
  });

  it("uses Space to open a row too, when rows cannot be selected", async () => {
    const user = userEvent.setup();
    const onRowActivate = vi.fn();
    render(<Grid onRowActivate={onRowActivate} />);
    rowsOf()[1]?.focus();
    await user.keyboard(" ");
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[1]);
  });

  it("marks the open row with aria-current and draws it selected", () => {
    render(<Grid activeId="t4" />);
    expect(rowsOf()[3]).toHaveAttribute("aria-current", "true");
    expect(rowsOf()[3]).toHaveAttribute("data-active");
    expect(rowsOf()[2]).not.toHaveAttribute("aria-current");
  });

  it("leaves a click on a control inside a row to that control", async () => {
    const user = userEvent.setup();
    const onRowActivate = vi.fn();
    const columns: Column<Turn>[] = [{ id: "act", header: "Action", cell: (row) => <button>Copy {row.id}</button> }];
    render(<DataTable caption="Turns" columns={columns} rows={ROWS.slice(0, 2)} getRowId={getRowId} onRowActivate={onRowActivate} />);
    await user.click(screen.getByRole("button", { name: "Copy t1" }));
    expect(onRowActivate).not.toHaveBeenCalled();
  });
});

describe("DataTable: selection", () => {
  function Selectable({ initial = [] as string[], onRowActivate }: { initial?: string[]; onRowActivate?: (row: Turn) => void }) {
    const [ids, setIds] = useState<ReadonlySet<string>>(new Set(initial));
    return (
      <DataTable
        caption="Turns"
        columns={COLUMNS}
        rows={ROWS.slice(0, 4)}
        getRowId={getRowId}
        selectedIds={ids}
        onSelectedIdsChange={setIds}
        onRowActivate={onRowActivate}
        rowLabel={(row) => `Select turn ${row.id}`}
      />
    );
  }

  it("adds a checkbox column: a named checkbox per row and one for all", () => {
    render(<Selectable />);
    expect(screen.getByRole("checkbox", { name: "Select all rows" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select turn t2" })).toBeInTheDocument();
    expect(screen.getByRole("grid")).toHaveAttribute("aria-multiselectable", "true");
  });

  it("selects and clears rows, marking them aria-selected", async () => {
    const user = userEvent.setup();
    render(<Selectable />);
    await user.click(screen.getByRole("checkbox", { name: "Select turn t2" }));
    const row = screen.getAllByRole("row")[2] as HTMLElement;
    expect(row).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("checkbox", { name: "Select turn t2" }));
    expect(row).toHaveAttribute("aria-selected", "false");
  });

  it("shows the header box as mixed when some rows are chosen, and selects or clears all from it", async () => {
    const user = userEvent.setup();
    render(<Selectable initial={["t1"]} />);
    const all = screen.getByRole("checkbox", { name: "Select all rows" }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);

    await user.click(all);
    for (const row of screen.getAllByRole("row").slice(1)) expect(row).toHaveAttribute("aria-selected", "true");
    expect(all.checked).toBe(true);

    await user.click(all);
    for (const row of screen.getAllByRole("row").slice(1)) expect(row).toHaveAttribute("aria-selected", "false");
  });

  it("toggles the focused row with Space, and leaves Enter to open it", async () => {
    const user = userEvent.setup();
    const onRowActivate = vi.fn();
    render(<Selectable onRowActivate={onRowActivate} />);
    const row = screen.getAllByRole("row")[1] as HTMLElement;
    row.focus();
    await user.keyboard(" ");
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(onRowActivate).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onRowActivate).toHaveBeenCalledTimes(1);
  });

  it("does not move between rows when a key is pressed inside a row's checkbox", async () => {
    const user = userEvent.setup();
    render(<Selectable />);
    const box = screen.getByRole("checkbox", { name: "Select turn t1" });
    box.focus();
    await user.keyboard("{ArrowDown}");
    expect(box).toHaveFocus();
  });
});
