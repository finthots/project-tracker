import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
        "placeholder:text-gray-400 resize-y min-h-[80px]",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "disabled:bg-gray-50 disabled:text-gray-500",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
export { Textarea };
