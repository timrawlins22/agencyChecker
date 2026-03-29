import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, User, Building, Phone, ArrowLeft, MessageSquare, Activity, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        phone: '',
        message: ''
    });
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        
        try {
            const response = await fetch('/api/public/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to submit contact request');
            }
            
            setStatus('success');
        } catch (err) {
            console.error('Contact submission error:', err);
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 text-center border border-slate-200">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                            <Mail className="h-8 w-8 text-green-600" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Message Sent!</h2>
                        <p className="text-slate-600 mb-8 max-w-sm mx-auto">
                            Thanks for reaching out. Our sales team will get back to you within 1 business day.
                        </p>
                        <Button onClick={() => navigate('/')} className="w-full justify-center">
                            Return Home
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans w-full">
            {/* Nav (Simplified) */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between shadow-sm sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="bg-primary-600 p-2 rounded-lg">
                        <Activity className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-slate-900 tracking-tight">Agent<span className="text-primary-600">Portal</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <Link to="/pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                        Back to Pricing
                    </Link>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
                {/* Left Side: Contact Info */}
                <div className="flex-1 px-4 sm:px-6 lg:px-12 py-12 md:py-24 flex flex-col justify-center">
                    <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
                        Contact Sales
                    </h1>
                    <p className="mt-4 text-lg text-slate-600 max-w-md">
                        Need an enterprise plan for more than 20 carriers? Or just have some questions? Our team is ready to help design the right package for your agency.
                    </p>

                    <dl className="mt-12 space-y-8 text-slate-600">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary-100 text-primary-600">
                                <Mail className="h-6 w-6" />
                            </div>
                            <div>
                                <dt className="sr-only">Email</dt>
                                <dd className="text-base font-medium text-slate-900">sales@agentportal.com</dd>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary-100 text-primary-600">
                                <Phone className="h-6 w-6" />
                            </div>
                            <div>
                                <dt className="sr-only">Phone number</dt>
                                <dd className="text-base font-medium text-slate-900">+1 (555) 123-4567</dd>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary-100 text-primary-600">
                                <MessageSquare className="h-6 w-6" />
                            </div>
                            <div>
                                <dt className="sr-only">Live Chat</dt>
                                <dd className="text-base font-medium text-slate-900">Available Mon-Fri, 9am-5pm EST</dd>
                            </div>
                        </div>
                    </dl>
                </div>

                {/* Right Side: Form */}
                <div className="flex-1 px-4 sm:px-6 md:px-0 md:pr-12 py-12 md:py-24">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10 relative">
                        {status === 'error' && (
                            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-red-700 font-medium">There was an error sending your message. Please try again.</p>
                            </div>
                        )}
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <Input
                                    label="First Name"
                                    name="name"
                                    type="text"
                                    value={formData.name}
                                    onChange={handleChange}
                                    icon={User}
                                    placeholder="Jane"
                                    required
                                />
                                <Input
                                    label="Company Name"
                                    name="company"
                                    type="text"
                                    value={formData.company}
                                    onChange={handleChange}
                                    icon={Building}
                                    placeholder="Acme Insurance"
                                    required
                                />
                            </div>

                            <Input
                                label="Work Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                icon={Mail}
                                placeholder="jane@acmeinsurance.com"
                                required
                            />

                            <Input
                                label="Phone Number (Optional)"
                                name="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={handleChange}
                                icon={Phone}
                                placeholder="(555) 555-5555"
                            />

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">
                                    How can we help?
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    rows={4}
                                    value={formData.message}
                                    onChange={handleChange}
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm resize-none bg-slate-50 border p-3 outline-none transition-colors"
                                    placeholder="Tell us about your agency's needs..."
                                    required
                                />
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full justify-center shadow-lg shadow-primary-500/20 mt-4" 
                                size="lg"
                                loading={status === 'submitting'}
                            >
                                Send Message
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
