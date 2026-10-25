import { useEffect, useState } from "react";
import {
  Users,
  CalendarDays,
  Stethoscope,
  Activity,
  TrendingUp,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Appointment, Visit } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";

interface Stats {
  patients: number;
  appointmentsToday: number;
  pendingAppointments: number;
  activeServices: number;
  visitsThisMonth: number;
  revenueThisMonth: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      pRes,
      todayRes,
      pendingRes,
      servicesRes,
      visitsRes,
      apptRes,
    ] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .gte("appointment_date", startOfDay)
        .lt("appointment_date", endOfDay)
        .neq("status", "cancelled"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("visits")
        .select("id, cost")
        .gte("visit_date", startMonth),
      supabase
        .from("appointments")
        .select("id, appointment_date, status, notes, patients(name, phone), doctors(name)")
        .order("appointment_date", { ascending: false })
        .limit(5),
    ]);

    const visits = (visitsRes.data as Visit[] | null) || [];
    setStats({
      patients: pRes.count || 0,
      appointmentsToday: todayRes.count || 0,
      pendingAppointments: pendingRes.count || 0,
      activeServices: servicesRes.count || 0,
      visitsThisMonth: visits.length,
      revenueThisMonth: visits.reduce((s, v) => s + (v.cost || 0), 0),
    });
    setRecent((apptRes.data as Appointment[]) || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-slate-400">جارٍ التحميل...</div>;
  }

  const cards = [
    {
      label: "المرضى",
      value: stats?.patients ?? 0,
      icon: <Users size={22} />,
      color: "from-teal-500 to-emerald-500",
    },
    {
      label: "مواعيد اليوم",
      value: stats?.appointmentsToday ?? 0,
      icon: <CalendarDays size={22} />,
      color: "from-sky-500 to-blue-500",
    },
    {
      label: "مواعيد قيد الانتظار",
      value: stats?.pendingAppointments ?? 0,
      icon: <Clock size={22} />,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "الخدمات النشطة",
      value: stats?.activeServices ?? 0,
      icon: <Stethoscope size={22} />,
      color: "from-violet-500 to-fuchsia-500",
    },
    {
      label: "زيارات هذا الشهر",
      value: stats?.visitsThisMonth ?? 0,
      icon: <Activity size={22} />,
      color: "from-rose-500 to-pink-500",
    },
    {
      label: "الإيرادات هذا الشهر",
      value: formatMoney(stats?.revenueThisMonth ?? 0),
      icon: <TrendingUp size={22} />,
      color: "from-emerald-500 to-teal-600",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">لوحة التحكم</h1>
        <p className="text-sm text-slate-400 mt-1">نظرة عامة على نشاط العيادة</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} text-white flex items-center justify-center shadow-sm`}>
              {c.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 leading-tight">{c.value}</p>
              <p className="text-sm text-slate-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-slate-800 mb-4">آخر المواعيد</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">لا توجد مواعيد بعد</p>
        ) : (
          <div className="space-y-2">
            {recent.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition"
              >
                <div>
                  <p className="font-semibold text-slate-700">
                    {a.patients?.name || "—"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.doctors?.name ? `الطبيب: ${a.doctors.name}` : "بدون طبيب"}
                  </p>
                </div>
                <div className="text-sm text-slate-500">{formatDateTime(a.appointment_date)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
