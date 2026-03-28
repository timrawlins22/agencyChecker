import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { LogOut, Activity, Shield, Map } from "lucide-react"; // Added Shield
import { Button } from "./Button";
import { cn } from "../../lib/utils"; // Assuming cn utility is available here or needs to be added

export function Layout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation(); // Added useLocation

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    // Added navItems
    const navItems = [
        { label: "Dashboard", path: "/dashboard", icon: Activity },
        { label: "Credentials", path: "/credentials", icon: Shield },
        { label: "Mapper", path: "/mapper", icon: Map },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Navbar */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Modified this div to include navigation links */}
                        <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2">
                                <div className="bg-primary-600 p-1.5 rounded-lg">
                                    <Activity className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-lg font-bold text-slate-900 tracking-tight">Agent<span className="text-primary-600">Portal</span></span>
                            </div>

                            {/* New navigation links */}
                            <div className="hidden md:flex items-center gap-1">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2",
                                            location.pathname === item.path
                                                ? "bg-primary-50 text-primary-700"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:block text-sm text-slate-600">
                                Signed in as <span className="font-semibold text-slate-900">{user?.username || user?.name}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500">
                                <LogOut className="h-4 w-4 mr-2" />
                                Sign out
                            </Button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto py-8 sm:px-6 lg:px-8">
                {children}
            </main>

            <footer className="bg-white border-t border-slate-200 mt-auto">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-slate-500">
                        &copy; {new Date().getFullYear()} Agent Portal System. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
