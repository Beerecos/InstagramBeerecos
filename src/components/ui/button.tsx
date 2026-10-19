import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "honey";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:opacity-90",
  secondary: "bg-surface-1 text-ink-1 ring-1 ring-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink-1",
  danger: "bg-status-critical text-white hover:opacity-90",
  honey: "bg-honey text-[#14130f] hover:brightness-105",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; className?: string; children?: ReactNode };

export function buttonClasses({ variant = "primary", size = "md", className }: Omit<Common, "icon" | "children">) {
  return cn(
    "inline-flex items-center justify-center rounded-full font-medium transition disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({ variant, size, icon, className, children, ...props }: Common & ComponentProps<"button">) {
  return (
    <button className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, className, children, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
