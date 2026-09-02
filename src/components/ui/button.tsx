import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: { variant: { default: "bg-[#275d4f] text-white hover:bg-[#1f4b40]", outline: "border bg-white hover:bg-slate-50", ghost: "hover:bg-slate-100" }, size: { default: "h-10 px-4", icon: "size-10 p-0", sm: "h-9 px-3" } },
  defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild, ...props }: ButtonProps) { const Comp = asChild ? Slot : "button"; return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
