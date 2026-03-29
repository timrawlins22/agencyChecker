import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);

        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Panel: Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-[480px] xl:w-[550px] z-10 bg-white">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div className="flex items-center gap-2 mb-10">
                        <div className="bg-primary-600 p-2 rounded-lg">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">Agent<span className="text-primary-600">Portal</span></span>
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Please sign in to access your dashboard.
                        </p>
                    </div>

                    <div className="mt-10">
                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <Input
                                type="text"
                                label="Username"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                icon={User}
                                required
                                className="w-full"
                            />

                            <div className="space-y-1">
                                <Input
                                    type="password"
                                    label="Password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    icon={Lock}
                                    required
                                    className="w-full"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <input
                                        id="remember-me"
                                        name="remember-me"
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                                    />
                                    <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-700">
                                        Remember me
                                    </label>
                                </div>

                                <div className="text-sm">
                                    <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                                        Forgot password?
                                    </a>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full shadow-lg shadow-primary-500/20 mt-4"
                                size="lg"
                                loading={loading}
                            >
                                Sign in
                            </Button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-slate-600">
                                Don't have an account?{' '}
                                <Link to="/pricing" className="font-medium text-primary-600 hover:text-primary-500">
                                    View Plans & Sign up
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Visual */}
            <div className="hidden lg:block relative flex-1">
                <div className="absolute inset-0 bg-slate-900">
                    {/* Abstract Gradient Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-slate-900 opacity-90"></div>

                    {/* Decorative abstract shapes */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] rounded-full bg-primary-500 opacity-20 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[600px] h-[600px] rounded-full bg-blue-500 opacity-20 blur-3xl"></div>
                </div>

                <div className="relative z-10 h-full flex flex-col justify-end p-20 text-white">
                    <div className="mb-6">
                        <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl mb-6">
                            <CheckCircle2 className="h-8 w-8 text-primary-300" />
                        </div>
                        <h2 className="text-4xl font-bold tracking-tight mb-4 leading-tight">Automated policy management for modern agents.</h2>
                        <p className="text-lg text-primary-100 max-w-md leading-relaxed">
                            Track your performance, monitor policy lapses, and manage carrier updates all in one secure place.
                        </p>
                    </div>
                    <div className="flex gap-4 pt-8 border-t border-white/10">
                        <div>
                            <p className="text-3xl font-bold">100%</p>
                            <p className="text-sm text-primary-200 uppercase tracking-wider font-medium mt-1">Secure</p>
                        </div>
                        <div className="w-px bg-white/10 h-10 self-center mx-2"></div>
                        <div>
                            <p className="text-3xl font-bold">24/7</p>
                            <p className="text-sm text-primary-200 uppercase tracking-wider font-medium mt-1">Availability</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
