import { cn } from "@/lib/cn";
import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-void-700 bg-void-900/80 px-3 py-2 text-sm text-void-100 placeholder:text-void-500 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/40 disabled:opacity-40 font-[family-name:var(--font-mono)] transition-colors",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
