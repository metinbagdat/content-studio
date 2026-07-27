import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, KanbanSquare, Activity, LogOut, Sparkles, CalendarClock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
    { to: "/", label: "Panel", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
    { to: "/articles", label: "Makaleler", icon: FileText, testid: "nav-articles" },
    { to: "/review", label: "İnceleme Kuyruğu", icon: KanbanSquare, testid: "nav-review" },
    { to: "/schedule", label: "Takvim", icon: CalendarClock, testid: "nav-schedule" },
    { to: "/observability", label: "Gözlemlenebilirlik", icon: Activity, testid: "nav-observability" },
];

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0f1011] text-white flex">
            <aside className="w-64 shrink-0 bg-[#0A0A0B] border-r border-[#2A2E33] flex flex-col fixed h-screen">
                <div className="px-6 py-6 border-b border-[#2A2E33]">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")} data-testid="logo">
                        <div className="w-8 h-8 rounded-md bg-[#5E6AD2] flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="font-heading font-bold text-[15px] leading-none">content-studio</div>
                            <div className="text-[10px] text-[#8A8F98] uppercase tracking-[0.15em] mt-1">eğitim.today</div>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {NAV.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            data-testid={item.testid}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-200 ${
                                    isActive
                                        ? "bg-[#5E6AD2]/15 text-white"
                                        : "text-[#8A8F98] hover:bg-[#191A1B] hover:text-white"
                                }`
                            }
                        >
                            <item.icon className="w-[18px] h-[18px]" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="px-3 py-4 border-t border-[#2A2E33]">
                    <div className="px-3 py-2 mb-1">
                        <div className="text-sm font-medium truncate">{user?.name || "Admin"}</div>
                        <div className="text-xs text-[#8A8F98] truncate">{user?.email}</div>
                    </div>
                    <button
                        onClick={logout}
                        data-testid="logout-btn"
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[#8A8F98] hover:bg-[#191A1B] hover:text-white transition-colors duration-200"
                    >
                        <LogOut className="w-[18px] h-[18px]" />
                        Çıkış Yap
                    </button>
                </div>
            </aside>

            <main className="flex-1 ml-64 min-h-screen">{children}</main>
        </div>
    );
}
