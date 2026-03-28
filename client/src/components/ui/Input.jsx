import { cn } from "../../lib/utils";

export function Input({
    className,
    label,
    error,
    icon: Icon,
    ...props
}) {
    return (
        <div className={className}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon className="h-5 w-5 text-slate-400" />
                    </div>
                )}
                <input
                    className={cn(
                        "block w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm placeholder-slate-400 text-slate-900 transition-colors duration-200",
                        Icon && "pl-10",
                        error && "border-red-300 focus:border-red-500 focus:ring-red-500",
                        "py-2.5"
                    )}
                    {...props}
                />
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
}
