import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
        "placeholder:text-gray-400",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "disabled:bg-gray-50 disabled:text-gray-500",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
export { Input };
