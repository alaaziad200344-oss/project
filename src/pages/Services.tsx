import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Service } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { formatMoney } from "@/lib/format";

const empty = {
  name: "",
  description: "",
  price: 0,
  duration_minutes: 30,
  active: true,
};

export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("name");
    setServices((data as Service[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || "",
      price: s.price,
      duration_minutes: s.duration_minutes,
      active: s.active,
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from("services").update(form).eq("id", editing.id);
    } else {
      await supabase.from("services").insert(form);
    }
    setSaving(false);
    setModalOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from("services").delete().eq("id", deleteId);
    setDeleteId(null);
    await load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الخدمات والأسعار</h1>
          <p className="text-sm text-slate-400 mt-1">الخدمات التي تقدمها العيادة وأسعارها</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <Plus size={18} /> خدمة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400">جارٍ التحميل...</div>
        ) : services.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              title="لا توجد خدمات"
              subtitle="أضف الخدمات التي تقدمها العيادة"
              icon={<Stethoscope size={28} />}
            />
          </div>
        ) : (
          services.map((s) => (
            <div key={s.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-slate-800">{s.name}</h3>
                <span
                  className={`chip ${
                    s.active ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {s.active ? "متاح" : "غير متاح"}
                </span>
              </div>
              {s.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">{s.description}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{s.duration_minutes} دقيقة</span>
                <span className="text-lg font-bold text-teal-700">{formatMoney(s.price)}</span>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => openEdit(s)} className="btn-secondary flex-1 py-2">
                  <Pencil size={15} /> تعديل
                </button>
                <button
                  onClick={() => setDeleteId(s.id)}
                  className="btn-danger py-2 px-3"
                >
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
        title={editing ? "تعديل خدمة" : "خدمة جديدة"}
      >
        <div className="space-y-4">
          <div>
            <label className="label">اسم الخدمة *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">الوصف</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input min-h-[70px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">السعر (ر.س)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="label">المدة (دقيقة)</label>
              <input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                className="input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-teal-600 w-4 h-4"
            />
            <span className="text-sm text-slate-700">الخدمة متاحة للحجز</span>
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
        title="حذف الخدمة"
        message="هل تريد حذف هذه الخدمة؟"
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
