import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto",
          "w-full max-w-2xl mx-4",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 rounded-md p-1 hover:bg-gray-100"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-4 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
