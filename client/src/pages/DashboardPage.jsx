import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
    TrendingUp,
    Users,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Briefcase
} from 'lucide-react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, Tooltip, 
    AreaChart, Area, CartesianGrid 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Layout } from '../components/ui/Layout';

// Color palettes for charts mapped to the dynamic CSS variables
const COLORS = [
    'var(--color-primary-600)', 
    'var(--color-primary-400)', 
    'var(--color-primary-800)', 
    'var(--color-primary-500)', 
    'var(--color-primary-300)', 
    'var(--color-primary-700)', 
    'var(--color-primary-200)'
];
const STATUS_COLORS = {
    'In Force': 'var(--color-primary-500)', 
    'Active': 'var(--color-primary-500)',
    'Pending': 'var(--color-primary-300)', 
    'Lapsed': '#ef4444', // Keep semantic red for alerts
    'Cancelled': '#64748b', // Keep slate
    'Declined': '#64748b',
};

export default function DashboardPage() {
    const { logout } = useAuth();
    const [summary, setSummary] = useState(null);
    const [jobStatus, setJobStatus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Policy Details Modal State
    const [selectedActionItem, setSelectedActionItem] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [summaryRes, jobsRes] = await Promise.all([
                    axios.get('/api/dashboard/summary'),
                    axios.get('/api/dashboard/jobs')
                ]);
                setSummary(summaryRes.data);
                setJobStatus(jobsRes.data.carrierStatus);
            } catch (err) {
                console.error("Error fetching dashboard data:", err);
                setError("Failed to load dashboard data.");
                if (err.response && err.response.status === 401) {
                    logout(); // Auto logout on 401
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [logout]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-600 font-medium">
                {error}
            </div>
        );
    }

    return (
        <Layout>
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
                <p className="text-slate-500 mt-1">Here's what's happening with your policies today.</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                <KpiCard
                    title="Total Policies"
                    value={summary?.totalPolicies}
                    icon={<Users className="h-6 w-6 text-white" />}
                    color="bg-primary-400"
                />
                <KpiCard
                    title="Total Face Amount"
                    value={`$${summary?.totalFaceAmount}`}
                    icon={<TrendingUp className="h-6 w-6 text-white" />}
                    color="bg-primary-500"
                />
                <KpiCard
                    title="Annual Premium"
                    value={`$${summary?.totalAnnualPremium}`}
                    icon={<DollarSign className="h-6 w-6 text-white" />}
                    color="bg-primary-600"
                />
            </div>

            {/* Premium Growth Timeline (New) */}
            {summary?.premiumTrend && summary.premiumTrend.length > 0 && (
                <Card className="mb-8">
                    <CardHeader className="pb-2">
                        <CardTitle>Premium Written (Last 6 Months)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={summary.premiumTrend}>
                                    <defs>
                                        <linearGradient id="colorPremium" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="var(--color-primary-600)" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="var(--color-primary-600)" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="month" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 12 }} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                                        width={80}
                                    />
                                    <Tooltip 
                                        formatter={(value) => [`$${value.toLocaleString()}`, 'Premium']}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="premium" 
                                        stroke="var(--color-primary-600)" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorPremium)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content (Action Items & Job Status) */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Action Items (Lapsed/At-Risk Policies) */}
                    {summary?.actionItems && summary.actionItems.length > 0 && (
                        <Card className="border-l-4 border-l-red-500 shadow-md">
                            <CardHeader className="bg-red-50/50 border-b border-red-100 pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-red-700">
                                        <AlertTriangle className="h-5 w-5" />
                                        <h3 className="text-sm font-bold uppercase tracking-wider">Action Items</h3>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-white text-red-600 rounded-full border border-red-200">
                                        {summary.actionItems.length} Policies at Risk
                                    </span>
                                </div>
                            </CardHeader>
                            <div className="divide-y divide-red-50">
                                {summary.actionItems.map((item) => (
                                    <div key={item.id} className="p-5 hover:bg-red-50/30 transition-colors group">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.type === 'Lapsed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {item.type}
                                                    </span>
                                                    <span className="text-xs font-medium text-slate-500">{item.carrier}</span>
                                                </div>
                                                <p className="font-semibold text-slate-900 text-lg">{item.client}</p>
                                                <p className="text-sm text-slate-500 mt-0.5 font-mono">{item.policy}</p>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                                                <div className="text-right">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Premium at Risk</p>
                                                    <p className="text-lg font-bold text-slate-900">${item.premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                                </div>
                                                <button 
                                                    onClick={() => setSelectedActionItem(item)}
                                                    className="px-4 py-2 bg-white border border-slate-200 shadow-sm text-sm font-semibold text-primary-600 rounded-lg hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition-colors ml-auto sm:ml-0 whitespace-nowrap"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Recent Job Status */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-slate-400" />
                                <CardTitle>Carrier Sync Status</CardTitle>
                            </div>
                        </CardHeader>
                        <div className="divide-y divide-slate-100">
                            {jobStatus.map((job, idx) => (
                                <div key={idx} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {getJobStatusIcon(job.status)}
                                            <div>
                                                <div className="font-medium text-slate-900">{job.carrier}</div>
                                                <div className="text-xs text-slate-500">Last Synced: {job.lastRun}</div>
                                            </div>
                                        </div>
                                        <StatusBadge status={job.status} />
                                    </div>
                                </div>
                            ))}
                            {jobStatus.length === 0 && (
                                <div className="px-6 py-8 text-center text-slate-500 bg-slate-50/30">
                                    No sync jobs found.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Sidebar (Breakdowns) */}
                <div className="space-y-8">

                    {/* Policy Status Breakdown (Bar Chart) */}
                    <Card>
                        <CardHeader className="pb-3 border-b-0">
                            <CardTitle>Policy Status</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="h-[220px] w-full">
                                {summary?.policyStatusBreakdown && summary.policyStatusBreakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart 
                                            data={summary.policyStatusBreakdown}
                                            layout="vertical"
                                            margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                            <XAxis type="number" hide />
                                            <YAxis 
                                                dataKey="status" 
                                                type="category" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                                                width={80}
                                            />
                                            <Tooltip 
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                                                {summary.policyStatusBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#cbd5e1'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Carrier Breakdown (Donut Chart) */}
                    <Card>
                        <CardHeader className="pb-3 border-b-0">
                            <CardTitle>Carrier Mix</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="h-[240px] w-full relative">
                                {summary?.carrierBreakdown && summary.carrierBreakdown.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={summary.carrierBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="count"
                                                nameKey="carrier"
                                                stroke="none"
                                            >
                                                {summary.carrierBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value) => [value, 'Policies']}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-sm text-slate-400">No data available</div>
                                )}
                                {/* Custom Legend */}
                                {summary?.carrierBreakdown && summary.carrierBreakdown.length > 0 && (
                                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                                        {summary.carrierBreakdown.slice(0, 6).map((entry, index) => (
                                            <div key={`legend-${index}`} className="flex items-center gap-1.5">
                                                <div 
                                                    className="w-2.5 h-2.5 rounded-full" 
                                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                />
                                                <span className="text-xs font-medium text-slate-600 truncate max-w-[80px]" title={entry.carrier}>
                                                    {entry.carrier}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Policy Details Modal */}
            {selectedActionItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="bg-primary-600 px-6 py-4 flex items-center justify-between text-white">
                            <div>
                                <h3 className="font-bold text-lg">Policy Details</h3>
                                <p className="text-primary-100 text-sm">{selectedActionItem.carrier} &bull; {selectedActionItem.policy}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedActionItem(null)}
                                className="p-1 rounded-md hover:bg-white/20 transition-colors"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Alert Box */}
                            <div className={`p-4 rounded-lg flex items-start gap-3 ${selectedActionItem.type === 'Lapsed' ? 'bg-red-50 text-red-900 border border-red-100' : 'bg-amber-50 text-amber-900 border border-amber-100'}`}>
                                <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${selectedActionItem.type === 'Lapsed' ? 'text-red-500' : 'text-amber-500'}`} />
                                <div>
                                    <h4 className="font-semibold">{selectedActionItem.type}</h4>
                                    <p className="text-sm opacity-90 mt-0.5">This policy requires immediate attention to prevent loss of coverage. Premium at risk: <strong>${selectedActionItem.premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>.</p>
                                </div>
                            </div>

                            {/* Client Info Grid */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Client Information</h4>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                    <div>
                                        <p className="text-slate-500">Owner Name</p>
                                        <p className="font-semibold text-slate-900">{selectedActionItem.client}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Date of Issue</p>
                                        <p className="font-medium text-slate-900">{selectedActionItem.date}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Carrier</p>
                                        <p className="font-medium text-slate-900">{selectedActionItem.carrier}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Policy Number</p>
                                        <p className="font-mono font-medium text-slate-900">{selectedActionItem.policy}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setSelectedActionItem(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Close
                            </button>
                            <a 
                                href={`tel:555-0199`} // Placeholder for actual client phone number
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 shadow-sm transition-colors flex items-center gap-2"
                            >
                                Call Client
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

function KpiCard({ title, value, icon, color }) {
    return (
        <Card className="border-none shadow-md overflow-visible relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                {/* Decorative background icon */}
                <div className="scale-150 transform text-slate-900">{icon}</div>
            </div>
            <CardContent className="flex items-start">
                <div className={`flex-shrink-0 rounded-xl p-3 shadow-lg shadow-primary-100 ${color}`}>
                    {icon}
                </div>
                <div className="ml-5">
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function getJobStatusIcon(status) {
    switch (status) {
        case 'SUCCESS': return <CheckCircle className="h-5 w-5 text-emerald-500" />;
        case 'FAILED': return <XCircle className="h-5 w-5 text-red-500" />;
        case 'MFA_WAIT': return <Clock className="h-5 w-5 text-amber-500" />;
        default: return <Clock className="h-5 w-5 text-slate-300" />;
    }
}

function StatusBadge({ status }) {
    const styles = {
        SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-100",
        FAILED: "bg-red-50 text-red-700 border-red-100",
        MFA_WAIT: "bg-amber-50 text-amber-700 border-amber-100",
        DEFAULT: "bg-slate-100 text-slate-700 border-slate-200"
    };

    const style = styles[status] || styles.DEFAULT;

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
            {status}
        </span>
    );
}
