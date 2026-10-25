import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  UserCog,
  Activity,
  Settings as SettingsIcon,
  Menu,
  X,
  HeartPulse,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Dashboard } from "@/pages/Dashboard";
import { Patients } from "@/pages/Patients";
import { Appointments } from "@/pages/Appointments";
import { Services } from "@/pages/Services";
import { Doctors } from "@/pages/Doctors";
import { Visits } from "@/pages/Visits";
import { Settings } from "@/pages/Settings";

type Page =
  | "dashboard"
  | "patients"
  | "appointments"
  | "services"
  | "doctors"
  | "visits"
  | "settings";

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "لوحة التحكم", icon: <LayoutDashboard size={20} /> },
  { id: "patients", label: "ملفات المرضى", icon: <Users size={20} /> },
  { id: "appointments", label: "المواعيد", icon: <CalendarDays size={20} /> },
  { id: "visits", label: "زيارات المرضى", icon: <Activity size={20} /> },
  { id: "doctors", label: "الأطباء", icon: <UserCog size={20} /> },
  { id: "services", label: "الخدمات والأسعار", icon: <Stethoscope size={20} /> },
  { id: "settings", label: "الإعدادات", icon: <SettingsIcon size={20} /> },
];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clinicName, setClinicName] = useState("عيادة الأسنان");

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "clinic_name")
      .maybeSingle()
      .then(({ data }) => {
        if ((data as { value: string } | null)?.value) {
          setClinicName((data as { value: string }).value);
        }
      });
  }, []);

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "patients":
        return <Patients />;
      case "appointments":
        return <Appointments />;
      case "visits":
        return <Visits />;
      case "doctors":
        return <Doctors />;
      case "services":
        return <Services />;
      case "settings":
        return <Settings />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-72 bg-white border-l border-slate-200 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-sm shadow-teal-500/30">
            <HeartPulse size={22} />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-tight">{clinicName}</h1>
            <p className="text-xs text-slate-400">نظام الإدارة الطبي</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden mr-auto p-2 rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setPage(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                page === item.id
                  ? "bg-teal-50 text-teal-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={page === item.id ? "text-teal-600" : "text-slate-400"}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">
            نظام إدارة عيادة الأسنان
          </p>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 h-16 bg-white border-b border-slate-200 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-slate-700">{clinicName}</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{renderPage()}</main>
      </div>
    </div>
  );
}
