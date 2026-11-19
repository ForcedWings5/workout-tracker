import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkBox } from "../../src/ui/MarkBox";

test("renders a button with the given accessible name", () => {
  render(<MarkBox state="suggested" label="Set 1: 65 lb, 10 reps, not done" onToggle={() => {}} />);
  expect(screen.getByRole("button", { name: "Set 1: 65 lb, 10 reps, not done" })).toBeInTheDocument();
});

test("done shows the Lucide check icon and no typed glyph", () => {
  render(<MarkBox state="done" label="Set 1: done" onToggle={() => {}} />);
  const button = screen.getByRole("button");
  expect(button.querySelector("svg")).not.toBeNull();
  expect(button.textContent).not.toMatch(/[✓✕✔✗]/);
  expect(button).toHaveAttribute("aria-pressed", "true");
});

test("suggested and current have no icon; skipped shows a minus icon", () => {
  const { rerender } = render(<MarkBox state="suggested" label="x" onToggle={() => {}} />);
  expect(screen.getByRole("button").querySelector("svg")).toBeNull();
  expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  rerender(<MarkBox state="current" label="x" onToggle={() => {}} />);
  expect(screen.getByRole("button").querySelector("svg")).toBeNull();
  rerender(<MarkBox state="skipped" label="x" onToggle={() => {}} />);
  expect(screen.getByRole("button").querySelector("svg")).not.toBeNull();
});

test("a click calls onToggle once", async () => {
  const onToggle = vi.fn();
  render(<MarkBox state="suggested" label="x" onToggle={onToggle} />);
  await userEvent.click(screen.getByRole("button"));
  expect(onToggle).toHaveBeenCalledTimes(1);
});
