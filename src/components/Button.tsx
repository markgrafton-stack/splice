import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "sm" | "md";
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all disabled:opacity-40 disabled:cursor-not-allowed rounded-full",
        size === "md" ? "px-5 py-2.5 text-sm" : "px-3.5 py-1.5 text-xs",
        variant === "primary" &&
          "bg-fst-red text-fst-cream hover:bg-fst-red-dark active:scale-[0.98] shadow-sm",
        variant === "dark" &&
          "bg-fst-black text-fst-cream hover:bg-fst-ink active:scale-[0.98] shadow-sm",
        variant === "secondary" &&
          "bg-transparent text-fst-black border-2 border-fst-black hover:bg-fst-black hover:text-fst-cream active:scale-[0.98]",
        variant === "ghost" && "bg-transparent text-fst-black hover:bg-black/5",
        className
      )}
      {...props}
    />
  );
}
