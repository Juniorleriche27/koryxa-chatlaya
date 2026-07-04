import { type ReactNode } from "react";
import clsx from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "article" | "div" | "section";
};

export default function GlowCard({ children, className, as: Tag = "div" }: Props) {
  return (
    <Tag className={clsx("kx-glow-card rounded-[24px] p-6", className)}>
      {children}
    </Tag>
  );
}
