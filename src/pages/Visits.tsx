import { useEffect, useState } from "react";
import { Plus, Activity, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Visit, Doctor, Patient } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime, formatMoney, toLocalInput } from "@/lib/format";

const empty = {
  patient_id: "",
  doctor_id: "",
  visit_date: "",
  diagnosis: "",
  treatment: "",
  prescription: "",
  cost: 0,
  notes: "",
};

export function Visits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadLists();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("visits")
      .select("*, patients(name, phone), doctors(name)")
      .order("visit_date", { ascending: false });
    setVisits((data as Visit[]) || []);
    setLoading(false);
  }

  async function loadLists() {
    const [p, d] = await Promise.all([
      supabase.from("patients").select("*").order("name"),
      supabase.from("doctors").select("*").order("name"),
    ]);
    setPatients((p.data as Patient[]) || []);
    setDoctors((d.data as Doctor[]) || []);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...empty, visit_date: toLocalInput(new Date().toISOString()) });
    setModalOpen(true);
  }

  function openEdit(v: Visit) {
    setEditing(v);
    setForm({
      patient_id: v.patient_id,
      doctor_id: v.doctor_id || "",
      visit_date: toLocalInput(v.visit_date),
      diagnosis: v.diagnosis || "",
      treatment: v.treatment || "",
      prescription: v.prescription || "",
      cost: v.cost,
      notes: v.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.patient_id || !form.visit_date) return;
    setSaving(true);
    const payload = {
      patient_id: form.patient_id,
      doctor_id: form.doctor_id || null,
      visit_date: new Date(form.visit_date).toISOString(),
      diagnosis: form.diagnosis || null,
      treatment: form.treatment || null,
      prescription: form.prescription || null,
      cost: Number(form.cost) || 0,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from("visits").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("visits").insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from("visits").delete().eq("id", deleteId);
    setDeleteId(null);
    await load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">زيارات المرضى</h1>
          <p className="text-sm text-slate-400 mt-1">متابعة وتسجيل زيارات المرضى</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} /> تسجيل زيارة
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">جارٍ التحميل...</div>
        ) : visits.length === 0 ? (
          <EmptyState
            title="لا توجد زيارات"
            subtitle="سجّل أول زيارة لمريض"
            icon={<Activity size={28} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-right">
                <tr>
                  <th className="px-5 py-3 font-semibold">المريض</th>
                  <th className="px-5 py-3 font-semibold">الطبيب</th>
                  <th className="px-5 py-3 font-semibold">التاريخ</th>
                  <th className="px-5 py-3 font-semibold">التشخيص</th>
                  <th className="px-5 py-3 font-semibold">التكلفة</th>
                  <th className="px-5 py-3 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3 font-semibold text-slate-700">
                      {v.patients?.name || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{v.doctors?.name || "—"}</td>
                    <td className="px-5 py-3 text-slate-600">{formatDateTime(v.visit_date)}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate">
                      {v.diagnosis || "—"}
                    </td>
                    <td className="px-5 py-3 font-semibold text-teal-700">
                      {v.cost > 0 ? formatMoney(v.cost) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(v)}
                          className="p-2 rounded-lg text-sky-600 hover:bg-sky-50 transition"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteId(v.id)}
                          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "تعديل الزيارة" : "تسجيل زيارة جديدة"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">المريض *</label>
              <select
                value={form.patient_id}
                onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                className="input"
              >
                <option value="">— اختر —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
                <option value="">— اختر —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">تاريخ ووقت الزيارة *</label>
            <input
              type="datetime-local"
              value={form.visit_date}
              onChange={(e) => setForm({ ...form, visit_date: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">التشخيص</label>
            <textarea
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              className="input min-h-[70px]"
            />
          </div>
          <div>
            <label className="label">العلاج المقدم</label>
            <textarea
              value={form.treatment}
              onChange={(e) => setForm({ ...form, treatment: e.target.value })}
              className="input min-h-[70px]"
            />
          </div>
          <div>
            <label className="label">الوصفة الطبية</label>
            <textarea
              value={form.prescription}
              onChange={(e) => setForm({ ...form, prescription: e.target.value })}
              className="input min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">التكلفة (ر.س)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            إلغاء
          </button>
          <button onClick={save} disabled={saving || !form.patient_id || !form.visit_date} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="حذف الزيارة"
        message="هل تريد حذف سجل هذه الزيارة؟"
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
