import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Search, Briefcase, Filter, Download, Plus, ChevronRight, XCircle, AlertTriangle, Check } from 'lucide-react';
import { Layout } from '../components/ui/Layout';
import { Card, CardContent } from '../components/ui/Card';

export default function PoliciesPage() {
    const { logout } = useAuth();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState([]);
    const [formData, setFormData] = useState({
        client: '', insuredName: '', carrier: '', policy: '', 
        status: 'Active', productType: '', faceAmount: '', premium: '', billingFreq: '', writingAgent: '', terminationDate: ''
    });

    // Derive unique statuses from the actual loaded data
    const uniqueStatuses = Array.from(new Set(policies.map(p => p.type || 'UNKNOWN'))).filter(Boolean);

    useEffect(() => {
        const fetchPolicies = async () => {
            try {
                const res = await axios.get('/api/dashboard/policies');
                setPolicies(res.data.policies);
            } catch (err) {
                console.error("Error fetching policies:", err);
                if (err.response && err.response.status === 401) {
                    logout();
                }
            } finally {
                setLoading(false);
            }
        };
        fetchPolicies();
    }, [logout]);

    const toggleStatusFilter = (status) => {
        setSelectedStatuses(prev => 
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                owner_name: formData.client,
                insured_name: formData.insuredName || formData.client,
                carrier: formData.carrier,
                policy_number: formData.policy,
                policy_status: formData.status,
                product_type: formData.productType,
                policy_face_amount: formData.faceAmount ? parseFloat(formData.faceAmount) : 0,
                premium: formData.premium ? parseFloat(formData.premium) : 0,
                billing_frequency: formData.billingFreq || null,
                writing_agent: formData.writingAgent || null,
                termination_date: formData.terminationDate || null
            };
            await axios.post('/api/dashboard/policies', payload);
            
            // Re-fetch to update table
            const res = await axios.get('/api/dashboard/policies');
            setPolicies(res.data.policies);
            
            setShowAddModal(false);
            setFormData({ client: '', insuredName: '', carrier: '', policy: '', status: 'Active', productType: '', faceAmount: '', premium: '', billingFreq: '', writingAgent: '', terminationDate: '' });
        } catch (err) {
            alert(err.response?.data?.error || "Failed to add manual policy");
        }
    };

    const filteredPolicies = policies.filter(p => {
        const matchesSearch = (p.client || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (p.policy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (p.carrier || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(p.type || 'UNKNOWN');
        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status) => {
        const s = status ? status.toLowerCase() : '';
        if (s.includes('lapsed') || s.includes('cancelled')) return "bg-red-50 text-red-700 border-red-200";
        if (s.includes('pending') || s.includes('grace')) return "bg-amber-50 text-amber-700 border-amber-200";
        if (s === 'active' || s.includes('force')) return "bg-emerald-50 text-emerald-700 border-emerald-200";
        return "bg-slate-50 text-slate-700 border-slate-200";
    };

    return (
        <Layout>
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Briefcase className="h-6 w-6 text-primary-600" /> Book of Business
                    </h2>
                    <p className="text-slate-500 mt-1">Manage all unified policies processed via the AgentPortal sync engine.</p>
                </div>
                <div className="flex items-center gap-3 relative">
                    <button 
                        onClick={() => setShowFilterMenu(!showFilterMenu)}
                        className={`px-4 py-2 bg-white border text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-colors ${showFilterMenu || selectedStatuses.length > 0 ? 'border-primary-500 text-primary-700 bg-primary-50' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                        <Filter className="w-4 h-4" /> 
                        Filter {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}
                    </button>

                    {showFilterMenu && (
                        <div className="absolute top-12 left-0 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 font-semibold text-xs uppercase tracking-wider text-slate-500">Filter by Status</div>
                            <div className="max-h-60 overflow-y-auto p-2">
                                {uniqueStatuses.length === 0 ? (
                                    <div className="p-3 text-sm text-slate-500">No statuses found.</div>
                                ) : (
                                    uniqueStatuses.map(status => (
                                        <button 
                                            key={status}
                                            onClick={() => toggleStatusFilter(status)}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 rounded-md transition-colors"
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedStatuses.includes(status) ? 'bg-primary-600 border-primary-600' : 'border-slate-300'}`}>
                                                {selectedStatuses.includes(status) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-slate-700">{status}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                            {selectedStatuses.length > 0 && (
                                <div className="p-2 border-t border-slate-100 bg-slate-50">
                                    <button onClick={() => setSelectedStatuses([])} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 py-1">Clear Filters</button>
                                </div>
                            )}
                        </div>
                    )}

                    <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Manual Policy
                    </button>
                </div>
            </div>

            <Card className="shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center bg-white justify-between">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by client name, policy number, or carrier..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                    </div>
                    <div className="text-sm font-medium text-slate-500 hidden sm:block">
                        Showing {filteredPolicies.length} policies
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold tracking-wider">Client / Insured</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Carrier & Policy</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Product</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Writing Agent</th>
                                <th className="px-6 py-4 font-semibold tracking-wider">Term Date</th>
                                <th className="px-6 py-4 font-semibold tracking-wider text-right">Face Amount</th>
                                <th className="px-6 py-4 font-semibold tracking-wider text-right">Premium</th>
                                <th className="px-4 py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex items-center justify-center gap-3">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                                            Loading policies...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPolicies.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                                        No policies found matching your search. Try adjusting your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredPolicies.map((policy) => (
                                    <tr 
                                        key={policy.id} 
                                        onClick={() => setSelectedPolicy(policy)}
                                        className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{policy.client}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{policy.insuredName !== policy.client ? 'Insured: ' + policy.insuredName : 'Owner & Insured'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{policy.carrier}</div>
                                            <div className="text-xs font-mono text-slate-500 mt-0.5">{policy.policy}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getStatusStyle(policy.type)}`}>
                                                {policy.type || 'UNKNOWN'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 max-w-[200px] truncate">{policy.productName}</div>
                                            <div className="text-xs text-slate-500">{policy.productType !== 'N/A' ? policy.productType : ''}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">{policy.writingAgent}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600">{policy.terminationDate !== 'N/A' ? policy.terminationDate : '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                                            ${policy.faceAmount ? policy.faceAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-900">${policy.premium ? policy.premium.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</div>
                                            <div className="text-[10px] text-slate-400 uppercase font-semibold">{policy.billingFreq !== 'N/A' ? policy.billingFreq : ''}</div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary-600 transition-colors" />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Expanded Policy Details Modal inside the CRM page */}
            {selectedPolicy && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="bg-primary-600 px-6 py-4 flex items-center justify-between text-white">
                            <div>
                                <h3 className="font-bold text-lg">Policy Details</h3>
                                <p className="text-primary-100 text-sm opacity-90">{selectedPolicy.carrier} &bull; <span className="font-mono">{selectedPolicy.policy}</span></p>
                            </div>
                            <button 
                                onClick={() => setSelectedPolicy(null)}
                                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                            >
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Alert Box for At-Risk Policies */}
                            {(selectedPolicy.type === 'Lapsed' || selectedPolicy.type === 'Pending Lapse' || selectedPolicy.type === 'Grace Period') && (
                                <div className={`p-4 rounded-xl flex items-start gap-4 ${selectedPolicy.type === 'Lapsed' ? 'bg-red-50 text-red-900 border border-red-100' : 'bg-amber-50 text-amber-900 border border-amber-100'}`}>
                                    <div className={`p-2 rounded-full ${selectedPolicy.type === 'Lapsed' ? 'bg-red-100' : 'bg-amber-100'}`}>
                                        <AlertTriangle className={`h-5 w-5 ${selectedPolicy.type === 'Lapsed' ? 'text-red-600' : 'text-amber-600'}`} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm tracking-wide uppercase">{selectedPolicy.type} ALERT</h4>
                                        <p className="text-sm opacity-80 mt-1 leading-relaxed">This policy requires immediate attention to prevent loss of coverage. Premium at risk: <strong>${selectedPolicy.premium.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>.</p>
                                    </div>
                                </div>
                            )}

                            {/* Status Badge Full */}
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                <div>
                                    <span className="text-sm font-semibold text-slate-500 mr-3">Current Status:</span>
                                    <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${getStatusStyle(selectedPolicy.type)}`}>
                                        {selectedPolicy.type || 'UNKNOWN'}
                                    </span>
                                </div>
                                <div className="text-sm font-medium text-slate-500">
                                    Last Synced: <span className="text-slate-900">{new Date().toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* The Expanded 3-Panel Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                
                                {/* Client & Owner Info */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400"></div>
                                        Client Information
                                    </h4>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Owner Name</p>
                                            <p className="font-bold text-slate-900 text-base">{selectedPolicy.client}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Insured Name</p>
                                            <p className="font-semibold text-slate-800">{selectedPolicy.insuredName || 'Same as Owner'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Insured Birth Date</p>
                                            <p className="font-semibold text-slate-800">{selectedPolicy.insuredBirth}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Product Info */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400"></div>
                                        Product Details
                                    </h4>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Carrier</p>
                                            <p className="font-bold text-slate-900 text-base">{selectedPolicy.carrier}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Product Name</p>
                                            <p className="font-semibold text-slate-800">{selectedPolicy.productName}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Product Type</p>
                                            <p className="font-semibold text-slate-800">{selectedPolicy.productType}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs font-medium mb-0.5">Writing Agent</p>
                                            <p className="font-semibold text-slate-800">{selectedPolicy.writingAgent}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Coverage Grid */}
                                <div className="md:col-span-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400"></div>
                                        Coverage & Economics
                                    </h4>
                                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-6 text-sm">
                                            <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                <p className="text-slate-500 text-xs font-medium mb-1">Total Face Amount</p>
                                                <p className="font-black text-slate-900 text-xl">${selectedPolicy.faceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                                <p className="text-slate-500 text-xs font-medium mb-1">Scheduled Premium</p>
                                                <p className="font-black text-slate-900 text-xl text-primary-600">${selectedPolicy.premium.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            
                                            <div>
                                                <p className="text-slate-500 text-xs font-medium mb-0.5">Billing Freq</p>
                                                <p className="font-semibold text-slate-800">{selectedPolicy.billingFreq}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 text-xs font-medium mb-0.5">Pay Method</p>
                                                <p className="font-semibold text-slate-800">{selectedPolicy.paymentMethod}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 text-xs font-medium mb-0.5">Issue Date</p>
                                                <p className="font-semibold text-slate-800">{selectedPolicy.date}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500 text-xs font-medium mb-0.5">Termination Date</p>
                                                <p className="font-semibold text-slate-800">{selectedPolicy.terminationDate}</p>
                                            </div>
                                            <div className="sm:col-span-4 pt-2 mt-2 border-t border-slate-200 border-dashed flex justify-between items-center">
                                                <div>
                                                    <p className="text-slate-500 text-xs font-medium mb-0.5">Term Duration</p>
                                                    <p className="font-semibold text-slate-800">{selectedPolicy.termDuration}</p>
                                                </div>
                                                <p className="text-xs font-mono text-slate-400 pt-3">ID: {selectedPolicy.id}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button 
                                onClick={() => setSelectedPolicy(null)}
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <a 
                                href={`tel:555-0199`}
                                className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-primary-700 hover:shadow-lg transition-all flex items-center gap-2"
                            >
                                Contact Client
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Manual Policy Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-primary-600" /> Convert Manual Policy
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="p-6 space-y-6">
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Owner Name *</label>
                                    <input required type="text" value={formData.client} onChange={e => setFormData({...formData, client: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="John Doe" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Insured Name</label>
                                    <input type="text" value={formData.insuredName} onChange={e => setFormData({...formData, insuredName: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="Jane Doe (Leave blank if same)" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Carrier Name *</label>
                                    <input required type="text" value={formData.carrier} onChange={e => setFormData({...formData, carrier: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="e.g. Foresters" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Policy Number *</label>
                                    <input required type="text" value={formData.policy} onChange={e => setFormData({...formData, policy: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="POL-123456" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Writing Agent</label>
                                    <input type="text" value={formData.writingAgent} onChange={e => setFormData({...formData, writingAgent: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="Agent Name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Term Date</label>
                                    <input type="date" value={formData.terminationDate} onChange={e => setFormData({...formData, terminationDate: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
                                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                                        <option value="Active">Active</option>
                                        <option value="In Force">In Force</option>
                                        <option value="Grace Period">Grace Period</option>
                                        <option value="Pending Lapse">Pending Lapse</option>
                                        <option value="Lapsed">Lapsed</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Product Type</label>
                                    <input type="text" value={formData.productType} onChange={e => setFormData({...formData, productType: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="e.g. Whole Life" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Face Amount ($)</label>
                                    <input type="number" step="0.01" value={formData.faceAmount} onChange={e => setFormData({...formData, faceAmount: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Premium ($)</label>
                                    <input type="number" step="0.01" value={formData.premium} onChange={e => setFormData({...formData, premium: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Billing Freq</label>
                                    <input type="text" value={formData.billingFreq} onChange={e => setFormData({...formData, billingFreq: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" placeholder="Monthly" />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-bold hover:bg-primary-700 transition-colors shadow-md">
                                    Submit Policy
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </Layout>
    );
}
