import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BentoCard } from "./BentoCard";

describe("BentoCard Component", () => {
  it("renders children correctly", () => {
    render(
      <BentoCard>
        <p>Test Content inside Bento</p>
      </BentoCard>
    );

    expect(screen.getByText("Test Content inside Bento")).toBeTruthy();
  });

  it("applies the dark variant styling class correctly", () => {
    const { container } = render(
      <BentoCard variant="dark">
        <p>Dark content</p>
      </BentoCard>
    );

    // Test that variant-specific classes apply (e.g. background class)
    expect((container.firstChild as HTMLElement).className).toContain("bg-[var(--card-dark)]");
  });
});
