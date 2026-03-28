import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export function Button({
    className,
    variant = "primary",
    size = "md",
    disabled,
    loading,
    children,
    ...props
}) {
    const variants = {
        primary: "bg-primary-600 text-white hover:bg-primary-700 shadow-sm focus:ring-primary-500",
        secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm focus:ring-primary-500",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm focus:ring-red-500",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200",
                variants[variant],
                sizes[size],
                (disabled || loading) && "opacity-50 cursor-not-allowed",
                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {children}
        </button>
    );
}
