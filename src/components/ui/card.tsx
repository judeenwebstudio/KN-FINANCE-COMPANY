import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.025)]", className)} {...props} />; }
