import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, FileText, Bot } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Patient, Visit, Appointment } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { sendToN8N } from "@/lib/settings";

type PatientForm = {
  name: string;
  phone: string;
  email: string;
  gender: Patient["gender"];
  birth_date: string;
  address: string;
  medical_history: string;
  notes: string;
};

const empty: PatientForm = {
  name: "",
  phone: "",
  email: "",
  gender: null,
  birth_date: "",
  address: "",
  medical_history: "",
  notes: "",
};

export function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filePatient, setFilePatient] = useState<Patient | null>(null);
  const [fileVisits, setFileVisits] = useState<Visit[]>([]);
  const [fileAppts, setFileAppts] = useState<Appointment[]>([]);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });
    setPatients((data as Patient[]) || []);
    setLoading(false);
  }

  const filtered = patients.filter((p) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone || "").includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  });

  function openNew() {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  }

  function openEdit(p: Patient) {
    setEditing(p);
    setForm({
      name: p.name,
      phone: p.phone || "",
      email: p.email || "",
      gender: p.gender,
      birth_date: p.birth_date || "",
      address: p.address || "",
      medical_history: p.medical_history || "",
      notes: p.notes || "",
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("patients").update(form).eq("id", editing.id);
    } else {
      const { data } = await supabase
        .from("patients")
        .insert(form)
        .select()
        .single();
      const newPatient = data as Patient | null;
      if (newPatient) {
        const r = await sendToN8N("n8n_register_patient", {
          patient_id: newPatient.id,
          name: newPatient.name,
          phone: newPatient.phone,
          email: newPatient.email,
        });
        setAiMsg(
          r.ok
            ? `تم إنشاء الملف وإرساله لوكيل الذكاء الاصطناعي بنجاح`
            : `تم إنشاء الملف. ${r.message || "تعذّر الإرسال للوكيل الذكاء الاصطناعي"}`
        );
      }
    }
    setSaving(false);
    setModalOpen(false);
    await load();
    setTimeout(() => setAiMsg(null), 5000);
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from("patients").delete().eq("id", deleteId);
    setDeleteId(null);
    await load();
  }

  async function openFile(p: Patient) {
    setFilePatient(p);
    const [v, a] = await Promise.all([
      supabase
        .from("visits")
        .select("*, doctors(name)")
        .eq("patient_id", p.id)
        .order("visit_date", { ascending: false }),
      supabase
        .from("appointments")
        .select("*, doctors(name, specialty)")
        .eq("patient_id", p.id)
        .order("appointment_date", { ascending: false }),
    ]);
    setFileVisits((v.data as Visit[]) || []);
    setFileAppts((a.data as Appointment[]) || []);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ملفات المرضى</h1>
          <p className="text-sm text-slate-400 mt-1">إدارة سجلات المرضى وملفاتهم</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} /> ملف جديد
        </button>
      </div>

      {aiMsg && (
        <div className="card p-3 px-4 bg-teal-50 border-teal-200 text-teal-700 text-sm flex items-center gap-2">
          <Bot size={16} /> {aiMsg}
        </div>
      )}

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف أو البريد..."
            className="input pr-10"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="لا توجد ملفات"
            subtitle="ابدأ بإنشاء ملف مريض جديد"
            icon={<FileText size={28} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-right">
                <tr>
                  <th className="px-5 py-3 font-semibold">الاسم</th>
                  <th className="px-5 py-3 font-semibold">الهاتف</th>
                  <th className="px-5 py-3 font-semibold">الجنس</th>
                  <th className="px-5 py-3 font-semibold">تاريخ الميلاد</th>
                  <th className="px-5 py-3 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3 font-semibold text-slate-700">{p.name}</td>
                    <td className="px-5 py-3 text-slate-600" dir="ltr">{p.phone || "—"}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.gender === "male" ? "ذكر" : p.gender === "female" ? "أنثى" : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {p.birth_date ? formatDate(p.birth_date) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openFile(p)}
                          className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition"
                          title="عرض الملف"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-lg text-sky-600 hover:bg-sky-50 transition"
                          title="تعديل"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                          title="حذف"
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
        title={editing ? "تعديل ملف المريض" : "ملف مريض جديد"}
        size="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">اسم المريض *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="الاسم الكامل"
            />
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
              dir="ltr"
              placeholder="05xxxxxxxx"
            />
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">الجنس</label>
            <select
              value={form.gender || ""}
              onChange={(e) =>
                setForm({ ...form, gender: (e.target.value || null) as Patient["gender"] })
              }
              className="input"
            >
              <option value="">— اختر —</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
          <div>
            <label className="label">تاريخ الميلاد</label>
            <input
              type="date"
              value={form.birth_date || ""}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">العنوان</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">التاريخ المرضي</label>
            <textarea
              value={form.medical_history}
              onChange={(e) => setForm({ ...form, medical_history: e.target.value })}
              className="input min-h-[80px]"
              placeholder="أمراض مزمنة، حساسية، أدوية حالية..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input min-h-[80px]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setModalOpen(false)} className="btn-secondary">
            إلغاء
          </button>
          <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </Modal>

      <Modal
        open={!!filePatient}
        onClose={() => setFilePatient(null)}
        title={`ملف المريض — ${filePatient?.name || ""}`}
        size="xl"
      >
        {filePatient && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="الهاتف" value={filePatient.phone} ltr />
              <Info label="البريد" value={filePatient.email} ltr />
              <Info
                label="الجنس"
                value={
                  filePatient.gender === "male" ? "ذكر" : filePatient.gender === "female" ? "أنثى" : null
                }
              />
              <Info
                label="تاريخ الميلاد"
                value={filePatient.birth_date ? formatDate(filePatient.birth_date) : null}
              />
              <Info label="العنوان" value={filePatient.address} />
              <Info label="تاريخ الإنشاء" value={formatDate(filePatient.created_at)} />
            </div>
            {filePatient.medical_history && (
              <div>
                <h4 className="font-semibold text-slate-700 mb-1">التاريخ المرضي</h4>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">
                  {filePatient.medical_history}
                </p>
              </div>
            )}
            {filePatient.notes && (
              <div>
                <h4 className="font-semibold text-slate-700 mb-1">ملاحظات</h4>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">
                  {filePatient.notes}
                </p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-slate-700 mb-3">المواعيد</h4>
              {fileAppts.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد مواعيد</p>
              ) : (
                <div className="space-y-2">
                  {fileAppts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl p-3"
                    >
                      <div>
                        <p className="font-medium text-slate-700">
                          {a.doctors?.name || "بدون طبيب"}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(a.appointment_date)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-slate-700 mb-3">زيارات المريض</h4>
              {fileVisits.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد زيارات مسجلة</p>
              ) : (
                <div className="space-y-2">
                  {fileVisits.map((v) => (
                    <div key={v.id} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">
                          {formatDateTime(v.visit_date)}
                        </span>
                        {v.cost > 0 && (
                          <span className="text-sm font-semibold text-teal-700">
                            {formatMoney(v.cost)}
                          </span>
                        )}
                      </div>
                      {v.diagnosis && (
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold">التشخيص: </span>
                          {v.diagnosis}
                        </p>
                      )}
                      {v.treatment && (
                        <p className="text-sm text-slate-700">
                          <span className="font-semibold">العلاج: </span>
                          {v.treatment}
                        </p>
                      )}
                      {v.prescription && (
                        <p className="text-sm text-slate-600">
                          <span className="font-semibold">الوصفة: </span>
                          {v.prescription}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="حذف الملف"
        message="سيتم حذف الملف وكل الموعد والزيارات المرتبطة به. هل أنت متأكد؟"
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string | null; ltr?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm text-slate-700 font-medium ${ltr ? "dir-ltr" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </p>
    </div>
  );
}
