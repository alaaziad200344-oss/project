import { useEffect, useState } from "react";
import { Save, Bot, Webhook, Building2, History, Eye, EyeOff, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Setting, AiLog } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { sendToN8N, type SettingKey } from "@/lib/settings";
import { EmptyState } from "@/components/EmptyState";

const WEBHOOK_FIELDS: { key: SettingKey; label: string; desc: string; testPayload: Record<string, unknown> }[] = [
  {
    key: "n8n_register_patient",
    label: "تسجيل ملف المريض",
    desc: "يُستدعى عند إنشاء ملف مريض جديد",
    testPayload: { test: true, name: "اختبار", phone: "0000000000" },
  },
  {
    key: "n8n_book_appointment",
    label: "حجز موعد",
    desc: "يُستدعى عند حجز موعد جديد",
    testPayload: { test: true, appointment_date: new Date().toISOString(), service_ids: [] },
  },
  {
    key: "n8n_confirm_appointment",
    label: "تأكيد موعد",
    desc: "يُستدعى عند تأكيد موعد أو إكماله",
    testPayload: { test: true, appointment_id: "test", status: "confirmed" },
  },
  {
    key: "n8n_cancel_appointment",
    label: "إلغاء موعد",
    desc: "يُستدعى عند إلغاء موعد",
    testPayload: { test: true, appointment_id: "test", status: "cancelled" },
  },
];

export function Settings() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [showSecrets, setShowSecrets] = useState(false);
  const [tab, setTab] = useState<"webhooks" | "clinic" | "logs">("webhooks");
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("settings").select("*");
    const map: Record<string, string> = {};
    (data as Setting[]).forEach((s) => (map[s.key] = s.value));
    setValues(map);
    await loadLogs();
  }

  async function save() {
    setSaving(true);
    const rows = Object.entries(values).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from("settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function testWebhook(field: { key: SettingKey; testPayload: Record<string, unknown> }) {
    if (!values[field.key]) {
      setTestResult((r) => ({ ...r, [field.key]: { ok: false, message: "أدخل رابط الـ webhook أولاً" } }));
      return;
    }
    setTestingKey(field.key);
    setTestResult((r) => ({ ...r, [field.key]: { ok: false, message: "" } }));
    const res = await sendToN8N(field.key, { ...field.testPayload, source: "settings_test" });
    setTestResult((r) => ({ ...r, [field.key]: { ok: res.ok, message: res.ok ? "تم الإرسال بنجاح" : res.message || "فشل الإرسال" } }));
    setTestingKey(null);
    await loadLogs();
  }

  async function loadLogs() {
    const { data: logsData } = await supabase
      .from("ai_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((logsData as AiLog[]) || []);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">الإعدادات</h1>
        <p className="text-sm text-slate-400 mt-1">روابط الربط مع وكيل الذكاء الاصطناعي وإعدادات العيادة</p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: "webhooks", label: "روابط الـ Webhook", icon: <Webhook size={16} /> },
          { id: "clinic", label: "بيانات العيادة", icon: <Building2 size={16} /> },
          { id: "logs", label: "سجل الذكاء الاصطناعي", icon: <History size={16} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              tab === t.id
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "webhooks" && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 text-slate-700">
              <Bot size={20} className="text-violet-600" />
              <h2 className="font-bold">روابط N8N — وكيل الذكاء الاصطناعي</h2>
            </div>
            <button
              onClick={() => setShowSecrets((s) => !s)}
              className="btn-ghost text-sm"
            >
              {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
              {showSecrets ? "إخفاء الروابط" : "إظهار الروابط"}
            </button>
          </div>
          <div className="space-y-4">
            {WEBHOOK_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="flex items-center justify-between">
                  <label className="label">{f.label}</label>
                  <button
                    onClick={() => testWebhook(f)}
                    disabled={testingKey === f.key}
                    className="btn-ghost text-xs py-1 px-2"
                  >
                    {testingKey === f.key ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    اختبار
                  </button>
                </div>
                <input
                  type={showSecrets ? "text" : "password"}
                  value={values[f.key] || ""}
                  onChange={(e) => {
                    setValues({ ...values, [f.key]: e.target.value });
                    setTestResult((r) => ({ ...r, [f.key]: { ok: false, message: "" } }));
                  }}
                  placeholder="https://n8n.example.com/webhook/..."
                  className="input"
                  dir="ltr"
                />
                <p className="text-xs text-slate-400 mt-1">{f.desc}</p>
                {testResult[f.key]?.message && (
                  <p
                    className={`text-xs mt-1.5 flex items-center gap-1 ${
                      testResult[f.key].ok ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {testResult[f.key].ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {testResult[f.key].message}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            {saved && <span className="text-sm text-teal-600">تم الحفظ</span>}
            <button onClick={save} disabled={saving} className="btn-primary">
              <Save size={16} /> {saving ? "جارٍ الحفظ..." : "حفظ الروابط"}
            </button>
          </div>

          <div className="mt-6 p-4 bg-violet-50 rounded-xl text-sm text-slate-600">
            <p className="font-semibold text-violet-700 mb-1">ملاحظة:</p>
            عند كل عملية (إنشاء مريض، حجز/تأكيد/إلغاء موعد) سيُرسل النظام تلقائياً بيانات العملية إلى الرابط المُسجّل هنا.
            يمكنك تعديل الروابط في أي وقت دون الحاجة لتعديل الكود. كما يمكن لوكيل الذكاء الاصطناعي استدعاء الـ API الخاص بالنظام عبر دالة الـ Edge المُجهّزة.
          </div>
        </div>
      )}

      {tab === "clinic" && (
        <div className="card p-6 max-w-xl">
          <h2 className="font-bold text-slate-700 mb-4">بيانات العيادة</h2>
          <div className="space-y-4">
            <div>
              <label className="label">اسم العيادة</label>
              <input
                value={values.clinic_name || ""}
                onChange={(e) => setValues({ ...values, clinic_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">رقم هاتف العيادة</label>
              <input
                value={values.clinic_phone || ""}
                onChange={(e) => setValues({ ...values, clinic_phone: e.target.value })}
                className="input"
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-6">
            {saved && <span className="text-sm text-teal-600">تم الحفظ</span>}
            <button onClick={save} disabled={saving} className="btn-primary">
              <Save size={16} /> {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-700">آخر عمليات الذكاء الاصطناعي</h2>
            <button onClick={loadLogs} className="btn-ghost text-sm">
              <History size={16} /> تحديث
            </button>
          </div>
          {logs.length === 0 ? (
            <EmptyState title="لا يوجد سجل" subtitle="ستظهر عمليات الـ webhook هنا" icon={<History size={28} />} />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className={`p-3 rounded-xl border text-sm ${
                    l.status === "success"
                      ? "bg-emerald-50/50 border-emerald-100"
                      : "bg-rose-50/50 border-rose-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">{l.action}</span>
                    <span
                      className={`chip ${
                        l.status === "success"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{l.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTime(l.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
