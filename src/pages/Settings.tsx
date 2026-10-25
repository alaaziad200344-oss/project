import { useEffect, useState } from "react";
import { Save, Bot, Webhook, Building2, History, Eye, EyeOff, Send, CheckCircle2, AlertCircle, Loader2, KeyRound, Copy, Table, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Setting, AiLog } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { sendToN8N, type WebhookAction } from "@/lib/settings";
import { EmptyState } from "@/components/EmptyState";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
const SERVICES_API_BASE = `${SUPABASE_URL}/functions/v1/services-api`;

const TEST_ACTIONS: { action: WebhookAction; label: string; desc: string; testPayload: Record<string, unknown> }[] = [
  {
    action: "register_patient",
    label: "تسجيل ملف المريض",
    desc: "يُستدعى عند إنشاء ملف مريض جديد",
    testPayload: { test: true, name: "اختبار", phone: "0000000000" },
  },
  {
    action: "book_appointment",
    label: "حجز موعد",
    desc: "يُستدعى عند حجز موعد جديد",
    testPayload: { test: true, appointment_date: new Date().toISOString(), service_ids: [] },
  },
  {
    action: "confirm_appointment",
    label: "تأكيد موعد",
    desc: "يُستدعى عند تأكيد موعد أو إكماله",
    testPayload: { test: true, appointment_id: "test", status: "confirmed" },
  },
  {
    action: "cancel_appointment",
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
  const [testingAction, setTestingAction] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

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

  async function testAction(item: { action: WebhookAction; testPayload: Record<string, unknown> }) {
    if (!values.n8n_webhook_url) {
      setTestResult((r) => ({
        ...r,
        [item.action]: { ok: false, message: "أدخل رابط الـ webhook أولاً" },
      }));
      return;
    }
    setTestingAction(item.action);
    setTestResult((r) => ({ ...r, [item.action]: { ok: false, message: "" } }));
    const res = await sendToN8N(item.action, { ...item.testPayload, source: "settings_test" });
    setTestResult((r) => ({
      ...r,
      [item.action]: { ok: res.ok, message: res.ok ? "تم الإرسال بنجاح" : res.message || "فشل الإرسال" },
    }));
    setTestingAction(null);
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
        <p className="text-sm text-slate-400 mt-1">رابط الربط الموحّد مع وكيل الذكاء الاصطناعي وإعدادات العيادة</p>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: "webhooks", label: "رابط الـ Webhook الموحّد", icon: <Webhook size={16} /> },
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
              <h2 className="font-bold">وكيل الذكاء الاصطناعي — رابط موحّد</h2>
            </div>
            <button
              onClick={() => setShowSecrets((s) => !s)}
              className="btn-ghost text-sm"
            >
              {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
              {showSecrets ? "إخفاء" : "إظهار"}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <Webhook size={14} /> رابط الـ Webhook الموحّد
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                value={values.n8n_webhook_url || ""}
                onChange={(e) => setValues({ ...values, n8n_webhook_url: e.target.value })}
                placeholder="https://n8n.example.com/webhook/..."
                className="input"
                dir="ltr"
              />
              <p className="text-xs text-slate-400 mt-1">
                رابط واحد تستقبله كل عمليات الذكاء الاصطناعي. يُميّز النوع عبر حقل <code className="text-violet-600">action</code> داخل البيانات.
              </p>
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <KeyRound size={14} /> مفتاح الـ API
              </label>
              <input
                type={showSecrets ? "text" : "password"}
                value={values.n8n_api_key || ""}
                onChange={(e) => setValues({ ...values, n8n_api_key: e.target.value })}
                placeholder="••••••••••••••••"
                className="input"
                dir="ltr"
              />
              <p className="text-xs text-slate-400 mt-1">
                يُرسل تلقائياً في ترويسة <code className="text-violet-600">Authorization: Bearer</code> مع كل طلب للوكيل.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            {saved && <span className="text-sm text-teal-600">تم الحفظ</span>}
            <button onClick={save} disabled={saving} className="btn-primary">
              <Save size={16} /> {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Table size={16} className="text-teal-600" />
              <h3 className="font-semibold text-slate-700 text-sm">روابط الـ API — لسحب الخدمات إلى n8n</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              استخدم أي رابط من اللي تحت في n8n لسحب الخدمات على شكل جدول. الطلبات لازم تحتوي ترويسة
              <code className="text-violet-600 mx-1">Authorization: Bearer &lt;المفتاح&gt;</code>
              بنفس المفتاح اللي فوق.
            </p>

            <div className="space-y-2.5">
              {[
                {
                  id: "csv",
                  icon: <FileSpreadsheet size={14} />,
                  label: "CSV (جدول مثل جوجل شيت — يُنزّل ملف)",
                  url: `${SERVICES_API_BASE}?format=csv`,
                  hint: "ينزّل ملف CSV جاهز لإكسل/جوجل شيت",
                },
                {
                  id: "table",
                  icon: <Table size={14} />,
                  label: "Table (JSON بأعمدة وصفوف)",
                  url: `${SERVICES_API_BASE}?format=table`,
                  hint: "مناسب لعقدة HTTP في n8n",
                },
                {
                  id: "json",
                  icon: <Bot size={14} />,
                  label: "JSON (افتراضي)",
                  url: `${SERVICES_API_BASE}`,
                  hint: "كل الخدمات كمصفوفة services",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <span className="text-teal-600">{item.icon}</span>
                      {item.label}
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.url, item.id)}
                      className="btn-ghost text-xs py-1 px-2"
                    >
                      {copied === item.id ? (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copied === item.id ? "تم النسخ" : "نسخ الرابط"}
                    </button>
                  </div>
                  <code
                    className="block text-xs text-slate-600 bg-white rounded-lg p-2 break-all dir-ltr"
                    dir="ltr"
                  >
                    {item.url}
                  </code>
                  <p className="text-xs text-slate-400 mt-1">{item.hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 p-3 bg-teal-50 rounded-xl text-xs text-slate-600">
              <p className="font-semibold text-teal-700 mb-1">مثال سريع في n8n:</p>
              <code className="block bg-white rounded-lg p-2 mt-1 dir-ltr" dir="ltr">
                GET {SERVICES_API_BASE}?format=csv
                <br />
                Header: Authorization: Bearer &lt;المفتاح&gt;
              </code>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">اختبار العمليات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEST_ACTIONS.map((item) => (
                <div key={item.action} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                    <button
                      onClick={() => testAction(item)}
                      disabled={testingAction === item.action}
                      className="btn-ghost text-xs py-1 px-2"
                    >
                      {testingAction === item.action ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      اختبار
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                  {testResult[item.action]?.message && (
                    <p
                      className={`text-xs mt-1.5 flex items-center gap-1 ${
                        testResult[item.action].ok ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {testResult[item.action].ok ? (
                        <CheckCircle2 size={12} />
                      ) : (
                        <AlertCircle size={12} />
                      )}
                      {testResult[item.action].message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 bg-violet-50 rounded-xl text-sm text-slate-600">
            <p className="font-semibold text-violet-700 mb-1">ملاحظة:</p>
            عند كل عملية (إنشاء مريض، حجز/تأكيد/إلغاء موعد) يُرسل النظام تلقائياً بيانات العملية إلى الرابط الموحّد،
            مع حقل <code className="text-violet-600">action</code> يحدّد نوع العملية ومفتاح الـ API في الترويسة.
            يمكنك تعديل الرابط والمفتاح في أي وقت دون الحاجة لتعديل الكود. كما يمكن لوكيل الذكاء الاصطناعي
            استدعاء الـ API الخاص بالنظام عبر دالة الـ Edge المُجهّزة.
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
