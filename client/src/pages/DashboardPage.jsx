import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import {
    LogOut,
    TrendingUp,
    Users,
    DollarSign,
    AlertTriangle,
    Activity,
    CheckCircle,
    XCircle,
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [jobStatus, setJobStatus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-600">
                {error}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navbar */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <Activity className="h-8 w-8 text-blue-600" />
                            <span className="ml-2 text-xl font-bold text-gray-900">AgentDashboard</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-700">
                                Welcome, <span className="font-medium">{user?.username || user?.name || 'Agent'}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* KPIs */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                    <KpiCard
                        title="Total Policies"
                        value={summary?.totalPolicies}
                        icon={<Users className="h-6 w-6 text-white" />}
                        color="bg-blue-500"
                    />
                    <KpiCard
                        title="Total Face Amount"
                        value={`$${summary?.totalFaceAmount}`}
                        icon={<TrendingUp className="h-6 w-6 text-white" />}
                        color="bg-green-500"
                    />
                    <KpiCard
                        title="Annual Premium"
                        value={`$${summary?.totalAnnualPremium}`}
                        icon={<DollarSign className="h-6 w-6 text-white" />}
                        color="bg-purple-500"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content (Alerts & Breakdown) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Urgent Alerts */}
                        {summary?.alerts && summary.alerts.length > 0 && (
                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                <div className="px-5 py-4 border-b border-gray-200 bg-red-50">
                                    <h3 className="text-lg leading-6 font-medium text-red-800 flex items-center">
                                        <AlertTriangle className="h-5 w-5 mr-2" />
                                        Urgent Alerts
                                    </h3>
                                </div>
                                <ul className="divide-y divide-gray-200">
                                    {summary.alerts.map((alert) => (
                                        <li key={alert.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-indigo-600 truncate">{alert.type}</p>
                                                    <p className="ml-1 text-sm text-gray-500">{alert.client} - {alert.policy}</p>
                                                </div>
                                                <div className="ml-2 flex-shrink-0 flex">
                                                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                        {alert.date}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Recent Job Status */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-200">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    Carrier Sync Status
                                </h3>
                            </div>
                            <ul className="divide-y divide-gray-200">
                                {jobStatus.map((job, idx) => (
                                    <li key={idx} className="px-4 py-4 sm:px-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0">
                                                    {getJobStatusIcon(job.status)}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">{job.carrier}</div>
                                                    <div className="text-sm text-gray-500">Last Run: {job.lastRun}</div>
                                                </div>
                                            </div>
                                            <div>
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getJobStatusColor(job.status)}`}>
                                                    {job.status}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                                {jobStatus.length === 0 && (
                                    <li className="px-4 py-4 text-sm text-gray-500 text-center">No jobs found.</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Sidebar (Breakdowns) */}
                    <div className="space-y-8">

                        {/* Policy Status Breakdown */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-200">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">Policy Status</h3>
                            </div>
                            <div className="p-4">
                                {summary?.policyStatusBreakdown.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-sm text-gray-600">{item.status}</span>
                                        <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Carrier Breakdown */}
                        <div className="bg-white shadow rounded-lg overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-200">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">Carrier Mix</h3>
                            </div>
                            <div className="p-4">
                                {summary?.carrierBreakdown.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-sm text-gray-600">{item.carrier}</span>
                                        <span className="text-sm font-semibold text-gray-900">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}

function KpiCard({ title, value, icon, color }) {
    return (
        <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
                <div className="flex items-center">
                    <div className={`flex-shrink-0 rounded-md p-3 ${color}`}>
                        {icon}
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
                            <dd>
                                <div className="text-2xl font-semibold text-gray-900">{value}</div>
                            </dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getJobStatusIcon(status) {
    switch (status) {
        case 'SUCCESS': return <CheckCircle className="h-6 w-6 text-green-500" />;
        case 'FAILED': return <XCircle className="h-6 w-6 text-red-500" />;
        case 'MFA_WAIT': return <Clock className="h-6 w-6 text-yellow-500" />;
        default: return <Clock className="h-6 w-6 text-gray-400" />;
    }
}

function getJobStatusColor(status) {
    switch (status) {
        case 'SUCCESS': return 'bg-green-100 text-green-800';
        case 'FAILED': return 'bg-red-100 text-red-800';
        case 'MFA_WAIT': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}
