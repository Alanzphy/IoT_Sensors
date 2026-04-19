import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PillButton } from "./PillButton";

describe("PillButton Component", () => {
  it("renders the given children text", () => {
    render(<PillButton>Click Me</PillButton>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", () => {
    const handleClick = vi.fn();
    render(<PillButton onClick={handleClick}>Action</PillButton>);

    fireEvent.click(screen.getByRole("button", { name: /action/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    const handleClick = vi.fn();
    render(
      <PillButton disabled onClick={handleClick}>
        Disabled
      </PillButton>
    );

    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("shows loading state and is disabled to block clicks", () => {
    const handleClick = vi.fn();
    render(
      <PillButton loading onClick={handleClick}>
        Loading...
      </PillButton>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("applies the primary variant by default", () => {
    render(<PillButton>Primary</PillButton>);
    const button = screen.getByRole("button", { name: /primary/i });
    expect(button).toHaveClass("bg-[#6D7E5E]");
  });
});
