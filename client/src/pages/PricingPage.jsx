import { Link } from 'react-router-dom';
import { CheckCircle2, Building, Activity, ShieldCheck, Rocket } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header / Nav (Simplified) */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="bg-primary-600 p-2 rounded-lg">
                        <Activity className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 tracking-tight">Agent<span className="text-primary-600">Portal</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
                    <Link to="/register">
                        <Button variant="outline" size="sm">Get Started</Button>
                    </Link>
                </div>
            </div>

            {/* Hero Section */}
            <div className="pt-16 pb-12 sm:pt-24 sm:pb-16 lg:pb-20 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto">
                <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl lg:text-6xl tracking-tight">
                    Pricing that scales with your agency
                </h1>
                <p className="mt-4 text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                    Automate your carrier connections, track your performance, and stop manual data entry. Start for free and upgrade when you need more power.
                </p>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    
                    {/* Free Tier */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col h-full relative hover:shadow-md transition-shadow">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-slate-500" />
                                Starter
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">Perfect for independent agents getting started.</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-4xl font-extrabold text-slate-900">$0</span>
                            <span className="text-base font-medium text-slate-500">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-700 font-medium">1 Carrier Connection</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Automated policy syncing</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Basic dashboard analytics</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Standard support</span>
                            </li>
                        </ul>
                        <Link to="/register?tier=free" className="block w-full">
                            <Button variant="outline" className="w-full justify-center">Get Started Free</Button>
                        </Link>
                    </div>

                    {/* Pro Tier (5 carriers) */}
                    <div className="bg-white rounded-2xl shadow-xl border-2 border-primary-500 p-8 flex flex-col h-full relative transform md:-translate-y-4">
                        <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                            <span className="bg-primary-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                                Most Popular
                            </span>
                        </div>
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Rocket className="h-5 w-5 text-primary-600" />
                                Professional
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">The ideal choice for growing agencies.</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-4xl font-extrabold text-slate-900">$49</span>
                            <span className="text-base font-medium text-slate-500">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-900 font-bold">Up to 5 Carrier Connections</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Advanced real-time syncing</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Lapse prediction alerts</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Priority email & chat support</span>
                            </li>
                        </ul>
                        <Link to="/register?tier=pro" className="block w-full">
                            <Button className="w-full justify-center shadow-lg shadow-primary-500/30">Start Free Trial</Button>
                        </Link>
                    </div>

                    {/* Enterprise Tier (20 carriers) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col h-full relative hover:shadow-md transition-shadow">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Building className="h-5 w-5 text-slate-500" />
                                Agency Plus
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">For large teams and maximum coverage.</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-4xl font-extrabold text-slate-900">$149</span>
                            <span className="text-base font-medium text-slate-500">/mo</span>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-900 font-bold">Up to 20 Carrier Connections</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Multiple user sub-accounts</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">Custom data export & reporting</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0 mt-0.5" />
                                <span className="text-slate-600 text-sm">24/7 dedicated phone support</span>
                            </li>
                        </ul>
                        <Link to="/register?tier=agency" className="block w-full">
                            <Button variant="outline" className="w-full justify-center">Choose Agency Plus</Button>
                        </Link>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <p className="text-slate-500 text-sm">
                        Need more than 20 carriers? <Link to="/contact" className="font-medium text-primary-600 hover:underline">Contact our sales team</Link> for a custom enterprise plan.
                    </p>
                </div>
            </div>
        </div>
    );
}
