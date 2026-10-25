import { useEffect, useState } from "react";
import { Plus, CalendarDays, Check, X, Bot, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Appointment, Doctor, Patient, Service } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime, formatMoney } from "@/lib/format";
import { sendToN8N, type SettingKey } from "@/lib/settings";

export function Appointments() {
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "completed" | "cancelled">(
    "all"
  );
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patient_id: "",
    doctor_id: "",
    appointment_date: "",
    notes: "",
    service_ids: [] as string[],
  });
  const [cost, setCost] = useState(0);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadLists();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*, patients(name, phone), doctors(name, specialty)")
      .order("appointment_date", { ascending: true });
    setAppts((data as Appointment[]) || []);
    setLoading(false);
  }

  async function loadLists() {
    const [p, d, s] = await Promise.all([
      supabase.from("patients").select("*").order("name"),
      supabase.from("doctors").select("*").order("name"),
      supabase.from("services").select("*").eq("active", true).order("name"),
    ]);
    setPatients((p.data as Patient[]) || []);
    setDoctors((d.data as Doctor[]) || []);
    setServices((s.data as Service[]) || []);
  }

  const filtered = appts.filter((a) => filter === "all" || a.status === filter);

  function toggleService(id: string) {
    setForm((f) => {
      const has = f.service_ids.includes(id);
      const next = has ? f.service_ids.filter((x) => x !== id) : [...f.service_ids, id];
      const total = next
        .map((sid) => services.find((s) => s.id === sid)?.price || 0)
        .reduce((a, b) => a + b, 0);
      setCost(total);
      return { ...f, service_ids: next };
    });
  }

  async function save() {
    if (!form.patient_id || !form.appointment_date) return;
    setSaving(true);
    const date = new Date(form.appointment_date).toISOString();
    const { data } = await supabase
      .from("appointments")
      .insert({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id || null,
        appointment_date: date,
        notes: form.notes || null,
        status: "pending",
        source: "manual",
      })
      .select()
      .single();
    const newAppt = data as Appointment | null;
    if (newAppt && form.service_ids.length) {
      const rows = form.service_ids.map((sid) => ({
        appointment_id: newAppt.id,
        service_id: sid,
      }));
      await supabase.from("appointment_services").insert(rows);
    }
    const r = await sendToN8N("n8n_book_appointment", {
      appointment_id: newAppt?.id,
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      appointment_date: date,
      service_ids: form.service_ids,
      total_cost: cost,
    });
    setAiMsg(
      r.ok
        ? "تم حجز الموعد وإرساله لوكيل الذكاء الاصطناعي"
        : `تم حجز الموعد. ${r.message || "تعذّر الإرسال للوكيل"}`
    );
    setSaving(false);
    setModalOpen(false);
    setForm({ patient_id: "", doctor_id: "", appointment_date: "", notes: "", service_ids: [] });
    setCost(0);
    await load();
    setTimeout(() => setAiMsg(null), 5000);
  }

  async function setStatus(a: Appointment, status: Appointment["status"], webhook: SettingKey) {
    await supabase.from("appointments").update({ status }).eq("id", a.id);
    const r = await sendToN8N(webhook, {
      appointment_id: a.id,
      patient_id: a.patient_id,
      doctor_id: a.doctor_id,
      status,
    });
    setAiMsg(
      r.ok
        ? "تم تحديث الحالة وإرسالها لوكيل الذكاء الاصطناعي"
        : `تم تحديث الحالة. ${r.message || "تعذّر الإرسال للوكيل"}`
    );
    await load();
    setTimeout(() => setAiMsg(null), 4000);
  }

  const filters: ("all" | Appointment["status"])[] = [
    "all",
    "pending",
    "confirmed",
    "completed",
    "cancelled",
  ];
  const labels: Record<string, string> = {
    all: "الكل",
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    completed: "مكتمل",
    cancelled: "ملغي",
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">المواعيد</h1>
          <p className="text-sm text-slate-400 mt-1">حجز وإدارة مواعيد المرضى</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus size={18} /> حجز موعد
        </button>
      </div>

      {aiMsg && (
        <div className="card p-3 px-4 bg-teal-50 border-teal-200 text-teal-700 text-sm flex items-center gap-2">
          <Bot size={16} /> {aiMsg}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-slate-400" />
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f
                ? "bg-teal-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {labels[f]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              title="لا توجد مواعيد"
              subtitle="ابدأ بحجز موعد جديد"
              icon={<CalendarDays size={28} />}
            />
          </div>
        ) : (
          filtered.map((a) => (
            <div key={a.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-800">{a.patients?.name || "—"}</p>
                  <p className="text-xs text-slate-400" dir="ltr">
                    {a.patients?.phone || ""}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <div className="space-y-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">الموعد:</span>
                  {formatDateTime(a.appointment_date)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">الطبيب:</span>
                  {a.doctors?.name || "غير محدد"}
                </div>
                {a.notes && (
                  <p className="text-slate-500 text-xs mt-2 bg-slate-50 rounded-lg p-2">
                    {a.notes}
                  </p>
                )}
                {a.source === "ai" && (
                  <span className="chip bg-violet-100 text-violet-700 mt-2">
                    <Bot size={12} /> حجز بواسطة الذكاء الاصطناعي
                  </span>
                )}
              </div>
              {a.status === "pending" && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setStatus(a, "confirmed", "n8n_confirm_appointment")}
                    className="btn-primary flex-1 py-2"
                  >
                    <Check size={16} /> تأكيد
                  </button>
                  <button
                    onClick={() => setStatus(a, "cancelled", "n8n_cancel_appointment")}
                    className="btn-danger flex-1 py-2"
                  >
                    <X size={16} /> إلغاء
                  </button>
                </div>
              )}
              {a.status === "confirmed" && (
                <button
                  onClick={() => setStatus(a, "completed", "n8n_confirm_appointment")}
                  className="btn-secondary w-full mt-4 py-2"
                >
                  <Check size={16} /> إكمال
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="حجز موعد جديد"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="label">المريض *</label>
            <select
              value={form.patient_id}
              onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
              className="input"
            >
              <option value="">— اختر المريض —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.phone || "بدون هاتف"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الطبيب</label>
            <select
              value={form.doctor_id}
              onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
              className="input"
            >
              <option value="">— اختر الطبيب —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.specialty ? `(${d.specialty})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">تاريخ ووقت الموعد *</label>
            <input
              type="datetime-local"
              value={form.appointment_date}
              onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">الخدمات</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
              {services.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                    form.service_ids.includes(s.id)
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.service_ids.includes(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="accent-teal-600"
                    />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </span>
                  <span className="text-xs font-semibold text-teal-700">{formatMoney(s.price)}</span>
                </label>
              ))}
            </div>
            {cost > 0 && (
              <div className="mt-2 text-sm text-slate-600 flex justify-between">
                <span>الإجمالي:</span>
                <span className="font-bold text-teal-700">{formatMoney(cost)}</span>
              </div>
            )}
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input min-h-[70px]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            إلغاء
          </button>
          <button
            onClick={save}
            disabled={saving || !form.patient_id || !form.appointment_date}
            className="btn-primary"
          >
            {saving ? "جارٍ الحجز..." : "حجز"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
