// @vitest-environment jsdom
//
// Tests for NotFoundView (E1-S1, AC3 UX).

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NotFoundView } from "./NotFoundView";

afterEach(cleanup);

describe("NotFoundView", () => {
  it("renders eyebrow '404 · not found'", () => {
    render(<NotFoundView scopeName="EU / Frankfurt" onBack={vi.fn()} />);
    screen.getByText("404 · not found");
  });

  it("renders heading 'Not found in this workspace'", () => {
    render(<NotFoundView scopeName="EU / Frankfurt" onBack={vi.fn()} />);
    screen.getByRole("heading", { name: /not found in this workspace/i });
  });

  it("renders back button with scope name", () => {
    render(<NotFoundView scopeName="EU / Frankfurt" onBack={vi.fn()} />);
    // getByRole throws if not found — existence asserted by not throwing
    screen.getByRole("button", { name: /back to EU \/ Frankfurt/i });
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(<NotFoundView scopeName="Northwind Trading" onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back to northwind trading/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("body copy references scopeName without implying denial or existence elsewhere", () => {
    render(<NotFoundView scopeName="US / Chicago" onBack={vi.fn()} />);
    const body = screen.getByText(/not available in US \/ Chicago/i);
    // Must NOT hint at record existence elsewhere (ADR-009)
    expect(body.textContent).not.toMatch(/permission|denied|forbidden|belong|another|elsewhere/i);
  });
});
