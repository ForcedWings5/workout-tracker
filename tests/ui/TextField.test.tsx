import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "../../src/ui/TextField";

// The saved value reaches the field through a live database query, which can lag behind the
// saves (it did on GitHub's slower machines). Here it never catches up at all.
test("leaving a field that couldn't be saved restores the old value, even before the screen has caught up", async () => {
  const saved: string[] = [];
  const onCommit = async (text: string) => {
    if (!text.trim()) throw new Error("Give the exercise a name");
    saved.push(text);
  };
  const user = userEvent.setup();
  render(
    <>
      <TextField label="Exercise name" value="Bench" onCommit={onCommit} />
      <button type="button">Elsewhere</button>
    </>,
  );
  const field = screen.getByLabelText("Exercise name");
  await user.click(field);
  await user.keyboard("{End}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}");
  expect(await screen.findByRole("alert")).toHaveTextContent("Give the exercise a name");
  expect(saved.at(-1)).toBe("B");
  await user.tab();
  await vi.waitFor(() => expect(saved.at(-1)).toBe("Bench"));
  expect(field).toHaveValue("Bench");
});
