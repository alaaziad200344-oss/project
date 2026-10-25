import { supabase } from "./supabase";
import type { Setting } from "./types";

const SETTING_KEYS = [
  "n8n_webhook_url",
  "n8n_api_key",
  "clinic_name",
  "clinic_phone",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];
export { SETTING_KEYS };

export type WebhookAction =
  | "register_patient"
  | "book_appointment"
  | "confirm_appointment"
  | "cancel_appointment";

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) throw error;
  const map: Record<string, string> = {};
  (data as Pick<Setting, "key" | "value">[]).forEach((r) => {
    map[r.key] = r.value;
  });
  return map;
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export async function sendToN8N(
  action: WebhookAction,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status?: number; message?: string }> {
  const { data: urlRow, error: urlErr } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "n8n_webhook_url")
    .maybeSingle();
  if (urlErr) return { ok: false, message: urlErr.message };
  const url = (urlRow as { value: string } | null)?.value?.trim();
  if (!url) return { ok: false, message: "لم يتم ضبط رابط الـ webhook الموحّد" };

  const { data: keyRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "n8n_api_key")
    .maybeSingle();
  const apiKey = (keyRow as { value: string } | null)?.value?.trim() || "";

  const body = { action, ...payload };

  let ok = false;
  let status: number | undefined;
  let message = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    ok = res.ok;
    status = res.status;
    message = res.ok ? "تم الإرسال" : `HTTP ${res.status}`;
  } catch (e) {
    ok = false;
    message = (e as Error).message;
  }

  await supabase.from("ai_logs").insert({
    action,
    payload: { webhook_url: url, ...body },
    result: ok ? { http_status: status } : null,
    status: ok ? "success" : "error",
    message,
  });

  return { ok, status, message };
}
