import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-400",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
