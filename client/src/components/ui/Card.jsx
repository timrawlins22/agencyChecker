import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
    return (
        <div
            className={cn(
                "bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ className, children, ...props }) {
    return (
        <div className={cn("px-6 py-4 border-b border-slate-100", className)} {...props}>
            {children}
        </div>
    );
}

export function CardTitle({ className, children, ...props }) {
    return (
        <h3 className={cn("text-lg font-semibold text-slate-900", className)} {...props}>
            {children}
        </h3>
    );
}

export function CardContent({ className, children, ...props }) {
    return (
        <div className={cn("p-6", className)} {...props}>
            {children}
        </div>
    );
}
