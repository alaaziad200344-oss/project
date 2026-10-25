import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Stethoscope, Check, X, Loader as Loader2, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Service } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { formatMoney } from "@/lib/format";

type Cell = "name" | "description" | "price" | "duration_minutes";

const emptyRow = {
  name: "",
  description: "",
  price: 0,
  duration_minutes: 30,
  active: true,
};

export function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCell, setEditCell] = useState<{ id: string; field: Cell } | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [newRow, setNewRow] = useState<typeof emptyRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, Set<Cell>>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (editCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editCell]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("name");
    setServices((data as Service[]) || []);
    setDirty({});
    setLoading(false);
  }

  function startEdit(id: string, field: Cell, value: string | number) {
    setEditCell({ id, field });
    setDraft(String(value));
  }

  function markDirty(id: string, field: Cell) {
    setDirty((d) => {
      const next = { ...d };
      const set = next[id] ? new Set(next[id]) : new Set<Cell>();
      set.add(field);
      next[id] = set;
      return next;
    });
  }

  async function commitEdit(s: Service, field: Cell) {
    if (!editCell || editCell.id !== s.id) return;
    let value: string | number = draft;
    if (field === "price" || field === "duration_minutes") {
      value = Number(draft);
      if (Number.isNaN(value) || value < 0) value = 0;
    }
    const updated = { ...s, [field]: value } as Service;
    setServices((list) => list.map((x) => (x.id === s.id ? updated : x)));
    setEditCell(null);
    markDirty(s.id, field);
  }

  async function saveRow(s: Service) {
    setSavingId(s.id);
    const { error } = await supabase
      .from("services")
      .update({
        name: s.name,
        description: s.description,
        price: s.price,
        duration_minutes: s.duration_minutes,
        active: s.active,
      })
      .eq("id", s.id);
    setSavingId(null);
    if (!error) {
      setDirty((d) => {
        const next = { ...d };
        delete next[s.id];
        return next;
      });
    }
  }

  async function toggleActive(s: Service) {
    const updated = { ...s, active: !s.active };
    setServices((list) => list.map((x) => (x.id === s.id ? updated : x)));
    setSavingId(s.id);
    const { error } = await supabase
      .from("services")
      .update({ active: updated.active })
      .eq("id", s.id);
    setSavingId(null);
    if (error) {
      setServices((list) => list.map((x) => (x.id === s.id ? s : x)));
    }
  }

  async function addRow() {
    if (!newRow || !newRow.name.trim()) return;
    setSavingId("new");
    const { data, error } = await supabase
      .from("services")
      .insert({
        name: newRow.name.trim(),
        description: newRow.description || null,
        price: newRow.price,
        duration_minutes: newRow.duration_minutes,
        active: newRow.active,
      })
      .select()
      .single();
    setSavingId(null);
    if (!error && data) {
      setServices((list) => [...list, data as Service]);
      setNewRow(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await supabase.from("services").delete().eq("id", deleteId);
    setServices((list) => list.filter((x) => x.id !== deleteId));
    setDeleteId(null);
  }

  const totalRevenue = services
    .filter((s) => s.active)
    .reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الخدمات والأسعار</h1>
          <p className="text-sm text-slate-400 mt-1">
            جدول الخدمات — اضغط على أي خلية للتعديل المباشر
          </p>
        </div>
        <button
          onClick={() => setNewRow({ ...emptyRow })}
          className="btn-primary"
          disabled={!!newRow}
        >
          <Plus size={18} /> خدمة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
            <Stethoscope size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">{services.length}</p>
            <p className="text-xs text-slate-400">إجمالي الخدمات</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Check size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">
              {services.filter((s) => s.active).length}
            </p>
            <p className="text-xs text-slate-400">خدمات متاحة</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Save size={18} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">{formatMoney(totalRevenue)}</p>
            <p className="text-xs text-slate-400">قيمة الخدمات المتاحة</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">جارٍ التحميل...</div>
        ) : services.length === 0 && !newRow ? (
          <EmptyState
            title="لا توجد خدمات"
            subtitle="أضف أول خدمة بالضغط على «خدمة جديدة»"
            icon={<Stethoscope size={28} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-right border-b border-slate-200">
                  <th className="px-4 py-3 font-semibold w-10">#</th>
                  <th className="px-4 py-3 font-semibold min-w-[180px]">اسم الخدمة</th>
                  <th className="px-4 py-3 font-semibold min-w-[220px]">الوصف</th>
                  <th className="px-4 py-3 font-semibold w-32">السعر (ر.س)</th>
                  <th className="px-4 py-3 font-semibold w-28">المدة (دقيقة)</th>
                  <th className="px-4 py-3 font-semibold w-24">الحالة</th>
                  <th className="px-4 py-3 font-semibold w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((s, i) => {
                  const isEditing = editCell?.id === s.id;
                  const rowDirty = dirty[s.id];
                  return (
                    <tr
                      key={s.id}
                      className={`group transition ${
                        rowDirty ? "bg-amber-50/40" : "hover:bg-slate-50/60"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-slate-400 text-xs tabular-nums">
                        {i + 1}
                      </td>
                      <CellTd
                        isEditing={isEditing && editCell?.field === "name"}
                        onClick={() => startEdit(s.id, "name", s.name)}
                      >
                        {isEditing && editCell?.field === "name" ? (
                          <EditableInput
                            inputRef={inputRef}
                            value={draft}
                            onChange={setDraft}
                            onCommit={() => commitEdit(s, "name")}
                            onCancel={() => setEditCell(null)}
                          />
                        ) : (
                          <span className="font-semibold text-slate-800">{s.name}</span>
                        )}
                      </CellTd>
                      <CellTd
                        isEditing={isEditing && editCell?.field === "description"}
                        onClick={() => startEdit(s.id, "description", s.description || "")}
                      >
                        {isEditing && editCell?.field === "description" ? (
                          <EditableInput
                            inputRef={inputRef}
                            value={draft}
                            onChange={setDraft}
                            onCommit={() => commitEdit(s, "description")}
                            onCancel={() => setEditCell(null)}
                          />
                        ) : (
                          <span className="text-slate-600 line-clamp-1">
                            {s.description || "—"}
                          </span>
                        )}
                      </CellTd>
                      <CellTd
                        isEditing={isEditing && editCell?.field === "price"}
                        onClick={() => startEdit(s.id, "price", s.price)}
                        align="left"
                      >
                        {isEditing && editCell?.field === "price" ? (
                          <EditableInput
                            inputRef={inputRef}
                            type="number"
                            value={draft}
                            onChange={setDraft}
                            onCommit={() => commitEdit(s, "price")}
                            onCancel={() => setEditCell(null)}
                          />
                        ) : (
                          <span className="font-semibold text-teal-700 tabular-nums">
                            {formatMoney(s.price)}
                          </span>
                        )}
                      </CellTd>
                      <CellTd
                        isEditing={isEditing && editCell?.field === "duration_minutes"}
                        onClick={() => startEdit(s.id, "duration_minutes", s.duration_minutes)}
                        align="left"
                      >
                        {isEditing && editCell?.field === "duration_minutes" ? (
                          <EditableInput
                            inputRef={inputRef}
                            type="number"
                            value={draft}
                            onChange={setDraft}
                            onCommit={() => commitEdit(s, "duration_minutes")}
                            onCancel={() => setEditCell(null)}
                          />
                        ) : (
                          <span className="text-slate-600 tabular-nums">
                            {s.duration_minutes}
                          </span>
                        )}
                      </CellTd>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleActive(s)}
                          disabled={savingId === s.id}
                          className={`chip transition ${
                            s.active
                              ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {savingId === s.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : s.active ? (
                            "متاح"
                          ) : (
                            "غير متاح"
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          {rowDirty && (
                            <button
                              onClick={() => saveRow(s)}
                              disabled={savingId === s.id}
                              className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition disabled:opacity-50"
                              title="حفظ التعديلات"
                            >
                              {savingId === s.id ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Save size={15} />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteId(s.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {newRow && (
                  <tr className="bg-teal-50/50 border-t-2 border-teal-200">
                    <td className="px-4 py-2.5 text-teal-500 text-xs">
                      <Plus size={14} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        autoFocus
                        value={newRow.name}
                        onChange={(e) => setNewRow({ ...newRow, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addRow();
                          if (e.key === "Escape") setNewRow(null);
                        }}
                        placeholder="اسم الخدمة..."
                        className="w-full px-2 py-1.5 rounded-lg border border-teal-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={newRow.description}
                        onChange={(e) => setNewRow({ ...newRow, description: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addRow();
                          if (e.key === "Escape") setNewRow(null);
                        }}
                        placeholder="وصف مختصر..."
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        value={newRow.price}
                        onChange={(e) =>
                          setNewRow({ ...newRow, price: Number(e.target.value) })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addRow();
                          if (e.key === "Escape") setNewRow(null);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        value={newRow.duration_minutes}
                        onChange={(e) =>
                          setNewRow({ ...newRow, duration_minutes: Number(e.target.value) })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addRow();
                          if (e.key === "Escape") setNewRow(null);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setNewRow({ ...newRow, active: !newRow.active })}
                        className={`chip ${
                          newRow.active
                            ? "bg-teal-100 text-teal-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {newRow.active ? "متاح" : "غير متاح"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={addRow}
                          disabled={savingId === "new" || !newRow.name.trim()}
                          className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 transition disabled:opacity-50"
                          title="إضافة"
                        >
                          {savingId === "new" ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Check size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => setNewRow(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
                          title="إلغاء"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-4 bg-slate-50/50">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-600">طريقة الاستخدام:</span>{" "}
          اضغط على أي خلية في الجدول لتعديلها مباشرةً، ثم اضغط Enter للحفظ المؤقت أو Escape للإلغاء.
          عند ظهور زر الحفظ (أخضر) بجانب الصف، اضغط عليه لحفظ التغييرات في قاعدة البيانات.
          يمكنك أيضاً تبديل حالة الخدمة بالضغط على شارة «متاح».
        </p>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="حذف الخدمة"
        message="هل تريد حذف هذه الخدمة؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function CellTd({
  children,
  onClick,
  isEditing,
  align = "right",
}: {
  children: React.ReactNode;
  onClick: () => void;
  isEditing: boolean;
  align?: "right" | "left";
}) {
  return (
    <td
      onClick={onClick}
      className={`px-4 py-2.5 cursor-text transition ${
        isEditing
          ? "bg-white ring-2 ring-inset ring-teal-400 p-0"
          : "hover:bg-teal-50/40 group-hover:bg-transparent"
      } ${align === "left" ? "text-left" : "text-right"}`}
    >
      {children}
    </td>
  );
}

function EditableInput({
  inputRef,
  value,
  onChange,
  onCommit,
  onCancel,
  type = "text",
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  type?: string;
}) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={onCommit}
      onClick={(e) => e.stopPropagation()}
      className="w-full px-4 py-2.5 text-sm bg-white border-2 border-teal-400 rounded-lg focus:outline-none tabular-nums"
    />
  );
}
