import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumberField } from "../../src/ui/NumberField";

test("weight uses the decimal keypad, amount the numeric keypad", () => {
  render(
    <>
      <NumberField label="Set 1 weight" value={65} unit="lb" kind="weight" draft={false} onCommit={() => {}} />
      <NumberField label="Set 1 reps" value={10} unit="reps" kind="amount" draft={false} onCommit={() => {}} />
    </>,
  );
  expect(screen.getByLabelText("Set 1 weight")).toHaveAttribute("inputmode", "decimal");
  expect(screen.getByLabelText("Set 1 reps")).toHaveAttribute("inputmode", "numeric");
});

test("shows the value and its unit", () => {
  render(<NumberField label="Set 1 weight" value={42.5} unit="lb" kind="weight" draft={false} onCommit={() => {}} />);
  expect(screen.getByLabelText("Set 1 weight")).toHaveValue("42.5");
  expect(screen.getByText("lb")).toBeInTheDocument();
});

test('typing "42,5" then blur commits 42.5', async () => {
  const onCommit = vi.fn();
  render(<NumberField label="w" value={undefined} unit="lb" kind="weight" draft={false} onCommit={onCommit} />);
  await userEvent.type(screen.getByLabelText("w"), "42,5");
  await userEvent.tab();
  expect(onCommit).toHaveBeenCalledWith(42.5);
});

test("clearing the field commits undefined (bodyweight)", async () => {
  const onCommit = vi.fn();
  render(<NumberField label="w" value={65} unit="lb" kind="weight" draft={false} onCommit={onCommit} />);
  await userEvent.clear(screen.getByLabelText("w"));
  expect(onCommit).toHaveBeenCalledWith(undefined);
});

test("a stray non-number never clears the value: blur restores it", async () => {
  const onCommit = vi.fn();
  render(<NumberField label="w" value={85} unit="lb" kind="weight" draft={false} onCommit={onCommit} />);
  const input = screen.getByLabelText("w");
  await userEvent.type(input, ".", { initialSelectionStart: 0, initialSelectionEnd: 2 });
  expect(input).toHaveValue(".");
  await userEvent.tab();
  expect(onCommit).not.toHaveBeenCalled();
  expect(input).toHaveValue("85");
});

test("saves while typing, without waiting for blur", async () => {
  const onCommit = vi.fn();
  render(<NumberField label="w" value={65} unit="lb" kind="weight" draft={false} onCommit={onCommit} />);
  await userEvent.type(screen.getByLabelText("w"), "70", { initialSelectionStart: 0, initialSelectionEnd: 2 });
  expect(onCommit).toHaveBeenLastCalledWith(70);
});

test("blur without a change does not commit", async () => {
  const onCommit = vi.fn();
  render(<NumberField label="w" value={65} unit="lb" kind="weight" draft={false} onCommit={onCommit} />);
  await userEvent.click(screen.getByLabelText("w"));
  await userEvent.tab();
  expect(onCommit).not.toHaveBeenCalled();
});

test("Enter commits", async () => {
  const onCommit = vi.fn();
  render(<NumberField label="w" value={65} unit="lb" kind="weight" draft={false} onCommit={onCommit} />);
  const input = screen.getByLabelText("w");
  await userEvent.clear(input);
  await userEvent.type(input, "70{Enter}");
  expect(onCommit).toHaveBeenCalledWith(70);
});
