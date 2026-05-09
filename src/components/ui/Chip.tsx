import * as React from "react";
import { cn } from "@/lib/util";

export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn("chip", active && "chip-active", className)}
      {...props}
    />
  );
}
