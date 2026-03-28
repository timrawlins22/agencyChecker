import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../hooks/useSocket';
import BrowserViewer from '../components/BrowserViewer';
import StepList from '../components/StepList';
import { Layout } from '../components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
    Play,
    Square,
    Loader2,
    Trash2,
    Eye,
    Map,
    Globe,
    ChevronDown,
    CheckCircle,
    XCircle,
    RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function MapperPage() {
    // --- State ---
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [startUrl, setStartUrl] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [currentUrl, setCurrentUrl] = useState('');
    const [recordedSteps, setRecordedSteps] = useState([]);
    const [savedPatterns, setSavedPatterns] = useState([]);
    const [viewingPattern, setViewingPattern] = useState(null);
    const [fetchingPatterns, setFetchingPatterns] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const { connected, emit, on, off } = useSocket();

    // --- Data Fetching ---
    useEffect(() => {
        fetchCompanies();
        fetchPatterns();
    }, []);

    const fetchCompanies = async () => {
        try {
            const res = await axios.get('/api/mapper/companies');
            setCompanies(res.data);
        } catch (err) {
            console.error('Failed to fetch companies:', err);
        }
    };

    const fetchPatterns = async () => {
        setFetchingPatterns(true);
        try {
            const res = await axios.get('/api/mapper/patterns');
            setSavedPatterns(res.data);
        } catch (err) {
            console.error('Failed to fetch patterns:', err);
        } finally {
            setFetchingPatterns(false);
        }
    };

    // --- Socket.io Event Handlers ---
    useEffect(() => {
        const handleFrame = (data) => {
            setScreenshot(data.image);
            setCurrentUrl(data.url);
        };

        const handleStep = (step) => {
            setRecordedSteps((prev) => [...prev, step]);
        };

        const handleStarted = () => {
            setIsLoading(false);
            setIsRecording(true);
        };

        const handleComplete = (data) => {
            setIsRecording(false);
            setScreenshot(null);
            fetchPatterns();
        };

        const handleError = (data) => {
            setIsRecording(false);
            setIsLoading(false);
            setScreenshot(null);
            console.error('Recording error:', data.error);
            alert(`Recording failed: ${data.error}`);
        };

        on('recording-frame', handleFrame);
        on('recording-step', handleStep);
        on('recording-started', handleStarted);
        on('recording-complete', handleComplete);
        on('recording-error', handleError);

        return () => {
            off('recording-frame', handleFrame);
            off('recording-step', handleStep);
            off('recording-started', handleStarted);
            off('recording-complete', handleComplete);
            off('recording-error', handleError);
        };
    }, [on, off]);

    // --- Actions ---
    const handleStartRecording = useCallback(() => {
        if (!selectedCompany || !startUrl) {
            alert('Please select a carrier and enter a start URL.');
            return;
        }

        setIsLoading(true);
        setRecordedSteps([]);
        setScreenshot(null);

        emit('start-recording', {
            companyId: selectedCompany.id,
            startUrl: startUrl.trim(),
        });
    }, [selectedCompany, startUrl, emit]);

    const handleStopRecording = useCallback(() => {
        emit('stop-recording');
        setIsRecording(false);
        setIsLoading(true);
        // The recording-complete event will handle the rest
        setTimeout(() => setIsLoading(false), 3000);
    }, [emit]);

    const handleClickAt = useCallback((coords) => {
        emit('recording-click', coords);
    }, [emit]);

    const handleTypeText = useCallback((data) => {
        emit('recording-type', data);
    }, [emit]);

    const handleKeypress = useCallback((data) => {
        emit('recording-keypress', data);
    }, [emit]);

    const handleDeletePattern = async (companyId) => {
        if (!confirm('Delete this mapping? The bot will fall back to hardcoded logic.')) return;
        try {
            await axios.delete(`/api/mapper/patterns/${companyId}`);
            fetchPatterns();
            if (viewingPattern?.companyId === companyId) setViewingPattern(null);
        } catch (err) {
            console.error('Failed to delete pattern:', err);
        }
    };

    const handleViewPattern = async (companyId) => {
        try {
            const res = await axios.get(`/api/mapper/patterns/${companyId}`);
            setViewingPattern(res.data);
        } catch (err) {
            console.error('Failed to fetch pattern:', err);
        }
    };

    // --- Render ---
    return (
        <Layout>
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Carrier Mapper</h2>
                <p className="text-slate-500 mt-1">
                    Record and manage automated login flows for carrier portals.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Browser Viewer (2/3 width) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Recording Controls */}
                    <Card className="overflow-visible">
                        <CardContent className="overflow-visible">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Company Selector */}
                                <div className="relative flex-1">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Carrier
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        disabled={isRecording}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors",
                                            selectedCompany
                                                ? "border-primary-200 bg-primary-50/50 text-primary-700"
                                                : "border-slate-200 bg-white text-slate-500",
                                            isRecording && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            <Map className="w-4 h-4" />
                                            {selectedCompany?.name || 'Select a carrier...'}
                                        </span>
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    {dropdownOpen && (
                                        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {companies.map((c) => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        setSelectedCompany(c);
                                                        setDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 transition-colors flex items-center justify-between"
                                                >
                                                    <span className="font-medium text-slate-700">{c.name}</span>
                                                    {c.hasPattern ? (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">MAPPED</span>
                                                    ) : null}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* URL Input */}
                                <div className="flex-1">
                                    <Input
                                        label="Start URL"
                                        value={startUrl}
                                        onChange={(e) => setStartUrl(e.target.value)}
                                        placeholder="https://carrier-portal.com/login"
                                        disabled={isRecording}
                                    />
                                </div>

                                {/* Start/Stop Button */}
                                <div className="flex items-end">
                                    {!isRecording ? (
                                        <Button
                                            onClick={handleStartRecording}
                                            disabled={isLoading || !connected || !selectedCompany || !startUrl}
                                            className="whitespace-nowrap"
                                        >
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <Play className="w-4 h-4 mr-2" />
                                            )}
                                            {isLoading ? 'Starting...' : 'Start Recording'}
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={handleStopRecording}
                                            variant="secondary"
                                            className="whitespace-nowrap bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                                        >
                                            <Square className="w-4 h-4 mr-2" />
                                            Stop Recording
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {!connected && (
                                <div className="mt-3 p-2 bg-amber-50 rounded-lg flex items-center gap-2 text-xs text-amber-700 border border-amber-100">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Socket disconnected. Make sure the backend is running.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Browser Frame */}
                    <BrowserViewer
                        screenshot={screenshot}
                        currentUrl={currentUrl}
                        isRecording={isRecording}
                        onClickAt={handleClickAt}
                        onTypeText={handleTypeText}
                        onKeypress={handleKeypress}
                    />
                </div>

                {/* Right Sidebar: Steps + Saved Patterns (1/3 width) */}
                <div className="space-y-6">
                    {/* Live Steps (during recording) */}
                    {(isRecording || recordedSteps.length > 0) && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    {isRecording && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                                    Live Steps
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <StepList steps={recordedSteps} title="" />
                            </CardContent>
                        </Card>
                    )}

                    {/* Saved Patterns */}
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Saved Mappings</CardTitle>
                                <Button variant="ghost" size="sm" onClick={fetchPatterns}>
                                    <RefreshCw className={cn("w-3.5 h-3.5", fetchingPatterns && "animate-spin")} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {savedPatterns.length === 0 ? (
                                <div className="text-center py-6">
                                    <Globe className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">No mappings yet</p>
                                    <p className="text-xs text-slate-400 mt-1">Record your first carrier flow above</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {savedPatterns.map((pattern) => (
                                        <div
                                            key={pattern.id}
                                            className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-sm text-slate-800">{pattern.companyName}</span>
                                                <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                                    <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                                    {pattern.stepCount} steps
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                Updated {new Date(pattern.updatedAt).toLocaleDateString()}
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs h-7 px-2"
                                                    onClick={() => handleViewPattern(pattern.companyId)}
                                                >
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    View
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeletePattern(pattern.companyId)}
                                                >
                                                    <Trash2 className="w-3 h-3 mr-1" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pattern Detail View */}
                    {viewingPattern && (
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{viewingPattern.companyName}</CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs"
                                        onClick={() => setViewingPattern(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <StepList steps={viewingPattern.steps} title="Pattern Steps" />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </Layout>
    );
}
