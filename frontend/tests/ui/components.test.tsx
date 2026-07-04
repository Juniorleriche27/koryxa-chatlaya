import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      <div {...props}>{children}</div>,
  },
  useInView: () => true,
}));

import ScrollReveal from "@/components/ui/ScrollReveal";
import CountUp from "@/components/ui/CountUp";

describe("ScrollReveal", () => {
  it("renders children", () => {
    render(<ScrollReveal><p>hello</p></ScrollReveal>);
    expect(screen.getByText("hello")).toBeTruthy();
  });
});

describe("CountUp", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  it("renders final value when inView", async () => {
    render(<CountUp to={100} suffix="+" />);
    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByText(/100\+/)).toBeTruthy();
  });
  it("renders prefix", () => {
    render(<CountUp to={50} prefix="~" />);
    expect(screen.getByText(/~/)).toBeTruthy();
  });
});
