import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Activity, AlertCircle, CheckCircle2, Mail, Building } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function RegisterPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [agencyName, setAgencyName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Mock registration logic
        try {
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call
            // For now, since there's no backend endpoint, we just display success or navigate to login
            // You could optionally log them in immediately if the auth context supported a mock signup
            alert('Registration successful! Please sign in.');
            navigate('/');
        } catch (err) {
            setError('Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Panel: Form */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-[480px] xl:w-[550px] z-10 bg-white">
                <div className="mx-auto w-full max-w-sm lg:w-96 my-8">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="bg-primary-600 p-2 rounded-lg">
                            <Activity className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900 tracking-tight">Agent<span className="text-primary-600">Portal</span></span>
                    </div>

                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Create your account</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Join us and start automating your policy management.
                        </p>
                    </div>

                    <div className="mt-8">
                        {error && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                type="text"
                                label="Full Name"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                icon={User}
                                required
                                className="w-full"
                            />

                            <Input
                                type="email"
                                label="Email Address"
                                placeholder="john@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                icon={Mail}
                                required
                                className="w-full"
                            />

                            <Input
                                type="text"
                                label="Agency Name"
                                placeholder="Smith & Co Insurance"
                                value={agencyName}
                                onChange={(e) => setAgencyName(e.target.value)}
                                icon={Building}
                                className="w-full"
                            />

                            <Input
                                type="text"
                                label="Username"
                                placeholder="Choose a username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                icon={User}
                                required
                                className="w-full"
                            />

                            <Input
                                type="password"
                                label="Password"
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                icon={Lock}
                                required
                                className="w-full"
                            />

                            <Button
                                type="submit"
                                className="w-full shadow-lg shadow-primary-500/20 mt-4"
                                size="lg"
                                loading={loading}
                            >
                                Sign up
                            </Button>
                        </form>
                        
                        <div className="mt-6 text-center">
                            <p className="text-sm text-slate-600">
                                Already have an account?{' '}
                                <Link to="/" className="font-medium text-primary-600 hover:text-primary-500">
                                    Sign in
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
                        <h2 className="text-4xl font-bold tracking-tight mb-4 leading-tight">Elevate your agency with intelligent insights.</h2>
                        <p className="text-lg text-primary-100 max-w-md leading-relaxed mb-6">
                            Say goodbye to manual tracking and focus on what truly matters: growing your business and supporting your clients.
                        </p>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-300" />
                                <span className="text-primary-50 font-medium">Streamlined agent credentialing</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-300" />
                                <span className="text-primary-50 font-medium">Intelligent automated carrier syncing</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-primary-300" />
                                <span className="text-primary-50 font-medium">Real-time lapse notifications</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
