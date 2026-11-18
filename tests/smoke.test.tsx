import { render, screen } from "@testing-library/react";
import App from "../src/App";

test("renders the Today screen", () => {
  render(<App />);
  expect(screen.getByText("Today")).toBeInTheDocument();
});
