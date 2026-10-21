import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-white rounded-lg border border-gray-200 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 py-3 border-b border-gray-100", className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 py-3", className)} {...props}>
      {children}
    </div>
  );
}
