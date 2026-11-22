import { render, screen } from "@testing-library/react";
import { Sheet } from "../../src/ui/Sheet";

// The page re-renders every second (the workout timer), handing the sheet a new onClose each time.
function Host({ tick }: { tick: number }) {
  return (
    <>
      <button type="button">Outside</button>
      <Sheet open onClose={() => {}} title="Delete set 1?">
        <button type="button">Inside {tick}</button>
      </Sheet>
    </>
  );
}

test("focus stays where it is inside the sheet when the page re-renders", () => {
  const { rerender } = render(<Host tick={1} />);
  screen.getByRole("button", { name: "Inside 1" }).focus();
  rerender(<Host tick={2} />);
  expect(screen.getByRole("button", { name: "Inside 2" })).toHaveFocus();
});
