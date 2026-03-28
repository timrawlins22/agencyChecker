import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Shield,
    CheckCircle,
    XCircle,
    Loader2,
    Key,
    Trash2,
    Plus,
    RefreshCw
} from 'lucide-react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    getSortedRowModel
} from '@tanstack/react-table';
import { Layout } from '../components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';

export default function CredentialsPage() {
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchCarriers();
    }, []);

    const fetchCarriers = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/agent/carriers/manage');
            setCarriers(response.data);
        } catch (err) {
            console.error("Failed to fetch carriers", err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectClick = (carrier) => {
        setSelectedCarrier(carrier);
        setFormData({ username: '', password: '' });
        setError('');
        setModalOpen(true);
    };

    const handleDisconnect = async (companyId) => {
        if (!confirm("Are you sure you want to disconnect? This will stop automated updates for this carrier.")) return;

        try {
            await axios.delete(`/api/agent/carrier/credentials/${companyId}`);
            fetchCarriers();
        } catch (err) {
            console.error("Failed to disconnect", err);
            alert("Failed to disconnect carrier");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            await axios.post('/api/agent/carrier/credentials', {
                companyId: selectedCarrier.id,
                username: formData.username,
                password: formData.password
            });
            setModalOpen(false);
            fetchCarriers();
        } catch (err) {
            console.error("Failed to save credentials", err);
            setError(err.response?.data?.error || "Failed to save credentials");
        } finally {
            setSubmitting(false);
        }
    };

    const columns = useMemo(() => [
        {
            accessorKey: 'carrier',
            header: 'Carrier',
            cell: info => (
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                        <Shield className="h-5 w-5 text-primary-600" />
                    </div>
                    <span className="font-medium text-slate-900">{info.getValue()}</span>
                </div>
            )
        },
        {
            accessorKey: 'hasCredentials',
            header: 'Status',
            cell: info => (
                info.getValue() ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                    </span>
                ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <XCircle className="w-3 h-3 mr-1" />
                        Not Configured
                    </span>
                )
            )
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: info => {
                const carrier = info.row.original;
                return carrier.hasCredentials ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDisconnect(carrier.id)}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Disconnect
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConnectClick(carrier)}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Connect
                    </Button>
                );
            }
        }
    ], []);

    const table = useReactTable({
        data: carriers,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    if (loading && carriers.length === 0) {
        return (
            <Layout>
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Carrier Credentials</h2>
                    <p className="text-slate-500 mt-1">Manage your logins for automated policy syncing.</p>
                </div>
                <Button variant="outline" onClick={fetchCarriers}>
                    <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {carriers.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                                        No carriers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Simple Modal for Credential Entry */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-all">
                    <Card className="w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle>Connect {selectedCarrier?.carrier}</CardTitle>
                            <p className="text-sm text-slate-500">Your credentials will be encrypted at rest.</p>
                        </CardHeader>
                        <CardContent>
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-100 flex items-start gap-2">
                                    <XCircle className="h-5 w-5 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Username"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    required
                                    placeholder="Carrier portal username"
                                    autoComplete="off"
                                />
                                <Input
                                    label="Password"
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    placeholder="Carrier portal password"
                                    autoComplete="off"
                                />
                                <div className="pt-4 flex gap-3">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="flex-1"
                                        onClick={() => setModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1"
                                        loading={submitting}
                                    >
                                        <Key className="w-4 h-4 mr-2" />
                                        Save Credentials
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </Layout>
    );
}
