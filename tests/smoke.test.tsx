import { render, screen } from "@testing-library/react";
import App from "../src/App";

test("renders the Today screen", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
});
