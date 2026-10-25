import { supabase } from "./supabase";
import type { Setting } from "./types";

const SETTING_KEYS = [
  "n8n_register_patient",
  "n8n_book_appointment",
  "n8n_confirm_appointment",
  "n8n_cancel_appointment",
  "clinic_name",
  "clinic_phone",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

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
  webhookKey: SettingKey,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status?: number; message?: string }> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", webhookKey)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  const url = (data as { value: string } | null)?.value?.trim();
  if (!url) return { ok: false, message: "لم يتم ضبط رابط الـ webhook لهذه العملية" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, message: res.ok ? "تم الإرسال" : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
