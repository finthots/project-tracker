import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "disabled:bg-gray-50 disabled:text-gray-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
export { Select };
