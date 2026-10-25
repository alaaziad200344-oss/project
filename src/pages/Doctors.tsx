import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Doctor } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";

const empty = {
  name: "",
  specialty: "",
  phone: "",
  email: "",
  active: true,
};

export function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("doctors").select("*").order("name");
    setDoctors((data as Doctor[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    setForm({
      name: d.name,
      specialty: d.specialty || "",
      phone: d.phone || "",
      email: d.email || "",
      active: d.active,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("doctors").update(form).eq("id", editing.id);
    } else {
      await supabase.from("doctors").insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from("doctors").delete().eq("id", deleteId);
    setDeleteId(null);
    await load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الأطباء</h1>
          <p className="text-sm text-slate-400 mt-1">إدارة أطباء العيادة</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} /> طبيب جديد
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400">جارٍ التحميل...</div>
        ) : doctors.length === 0 ? (
          <div className="col-span-full">
            <EmptyState title="لا يوجد أطباء" subtitle="أضف أطباء العيادة" icon={<UserCog size={28} />} />
          </div>
        ) : (
          doctors.map((d) => (
            <div key={d.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg">
                  {d.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{d.name}</h3>
                  <p className="text-sm text-slate-500">{d.specialty || "—"}</p>
                </div>
                <span
                  className={`chip ${
                    d.active ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {d.active ? "نشط" : "غير نشط"}
                </span>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                {d.phone && (
                  <p dir="ltr" className="text-right">
                    📞 {d.phone}
                  </p>
                )}
                {d.email && (
                  <p dir="ltr" className="text-right">
                    ✉️ {d.email}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => openEdit(d)} className="btn-secondary flex-1 py-2">
                  <Pencil size={15} /> تعديل
                </button>
                <button onClick={() => setDeleteId(d.id)} className="btn-danger py-2 px-3">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "تعديل طبيب" : "طبيب جديد"}
      >
        <div className="space-y-4">
          <div>
            <label className="label">الاسم *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">التخصص</label>
            <input
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className="input"
              placeholder="مثال: تقويم، جراحة فم..."
            />
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
              dir="ltr"
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
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-teal-600 w-4 h-4"
            />
            <span className="text-sm text-slate-700">الطبيب نشط ومتوفر للمواعيد</span>
          </label>
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

      <ConfirmDialog
        open={!!deleteId}
        title="حذف الطبيب"
        message="هل تريد حذف هذا الطبيب؟"
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
