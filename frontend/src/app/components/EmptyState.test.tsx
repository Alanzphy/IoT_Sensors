import { fireEvent, render, screen } from "@testing-library/react";
import { Leaf } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState Component", () => {
  it("renders the required icon and title", () => {
    render(<EmptyState icon={Leaf} title="No areas available" />);

    expect(screen.getByText("No areas available")).toBeInTheDocument();
    // In Lucide React, icons render as SVGs. We can check if an SVG is present inside the container.
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("No areas available");
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders a description if provided", () => {
    render(
      <EmptyState
        icon={Leaf}
        title="Nothing here"
        description="Try adding a new crop to see the data."
      />
    );
    expect(screen.getByText("Try adding a new crop to see the data.")).toBeInTheDocument();
  });

  it("renders an action button when action prop is provided and handles clicks", () => {
    const handleActionClick = vi.fn();

    render(
      <EmptyState
        icon={Leaf}
        title="Empty Dashboard"
        action={{
          label: "Add New Area",
          onClick: handleActionClick,
        }}
      />
    );

    const actionButton = screen.getByRole("button", { name: "Add New Area" });
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(handleActionClick).toHaveBeenCalledTimes(1);
  });

  it("does not render action button if action prop is omitted", () => {
    render(<EmptyState icon={Leaf} title="Empty Dashboard" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
