import {
    MousePointerClick,
    Type,
    Globe,
    Download,
    Flag,
    Square,
    Clock,
    Eye,
    ChevronRight
} from 'lucide-react';

const actionConfig = {
    click:        { icon: MousePointerClick, color: 'text-blue-500',    bg: 'bg-blue-50',    label: 'Click' },
    clickByText:  { icon: MousePointerClick, color: 'text-cyan-500',    bg: 'bg-cyan-50',    label: 'Click Text' },
    type:         { icon: Type,              color: 'text-amber-500',   bg: 'bg-amber-50',   label: 'Type' },
    navigate:     { icon: Globe,             color: 'text-emerald-500', bg: 'bg-emerald-50',  label: 'Navigate' },
    download:     { icon: Download,          color: 'text-purple-500',  bg: 'bg-purple-50',   label: 'Download' },
    marker:       { icon: Flag,              color: 'text-rose-500',    bg: 'bg-rose-50',     label: 'Marker' },
    end_session:  { icon: Square,            color: 'text-red-500',     bg: 'bg-red-50',      label: 'End' },
    wait_time:    { icon: Clock,             color: 'text-slate-500',   bg: 'bg-slate-50',    label: 'Wait' },
    wait_selector:{ icon: Eye,               color: 'text-primary-500',  bg: 'bg-primary-50',   label: 'Wait For' },
};

/**
 * StepList - Displays the list of recorded steps with icons and metadata.
 */
export default function StepList({ steps, title = 'Recorded Steps' }) {
    if (!steps || steps.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-sm text-slate-500">No steps recorded yet.</p>
                <p className="text-xs text-slate-400 mt-1">Interact with the browser to record steps</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{title}</h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {steps.length} steps
                </span>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                {steps.map((step, idx) => {
                    const config = actionConfig[step.action] || actionConfig.click;
                    const Icon = config.icon;
                    const isCredential = step.value === '[[USERNAME]]' || step.value === '[[PASSWORD]]';

                    return (
                        <div
                            key={idx}
                            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                            {/* Step number */}
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-slate-500">{step.step || idx + 1}</span>
                            </div>

                            {/* Action icon */}
                            <div className={`flex-shrink-0 p-1.5 rounded-md ${config.bg}`}>
                                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                            </div>

                            {/* Step details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">{config.label}</span>
                                    {isCredential && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                            CREDENTIAL
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                    {step.description || step.selector || step.url || step.text || '—'}
                                </p>
                                {step.value && !isCredential && step.action === 'type' && (
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                                        <ChevronRight className="w-2.5 h-2.5 inline" /> {step.value}
                                    </p>
                                )}
                            </div>

                            {/* Delay badge */}
                            {step.delay > 0 && (
                                <span className="flex-shrink-0 text-[10px] text-slate-400 font-mono">
                                    {step.delay}ms
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
