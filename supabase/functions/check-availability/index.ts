import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SLOT_MINUTES = 30;
const CLINIC_OPEN = 9; // 9 AM
const CLINIC_CLOSE = 18; // 6 PM

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use GET." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const action = (url.searchParams.get("action") || "available_slots").toLowerCase();
    const dateParam = url.searchParams.get("date")?.trim() || "";
    const doctorId = url.searchParams.get("doctor_id")?.trim() || "";

    // ---- Action: list a patient's own appointments ----
    if (action === "my_appointments") {
      const patientPhone = url.searchParams.get("phone")?.trim() || "";
      if (!patientPhone) {
        return new Response(
          JSON.stringify({ ok: false, error: "phone is required for action=my_appointments" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: patient } = await supabase
        .from("patients")
        .select("id, name")
        .eq("phone", patientPhone)
        .maybeSingle();
      if (!patient) {
        return new Response(
          JSON.stringify({ ok: true, appointments: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: appts, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, status, notes, doctor_id, doctors(name)")
        .eq("patient_id", (patient as { id: string }).id)
        .order("appointment_date", { ascending: true });
      if (error) {
        return new Response(
          JSON.stringify({ ok: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase.from("ai_logs").insert({
        action: "check_appointments_api",
        payload: { action, phone: patientPhone },
        result: { count: (appts || []).length },
        status: "success",
        message: `Queried appointments for patient phone ${patientPhone}`,
      });
      return new Response(
        JSON.stringify({ ok: true, patient, appointments: appts || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Action: available_slots (default) ----
    // Determine target date (default: today). If date given, validate it.
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam + "T00:00:00");
      if (Number.isNaN(targetDate.getTime())) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid date. Use YYYY-MM-DD." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      targetDate = new Date();
    }
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch existing appointments for that day (optionally filtered by doctor)
    let q = supabase
      .from("appointments")
      .select("appointment_date, doctor_id")
      .in("status", ["pending", "confirmed"])
      .gte("appointment_date", dayStart.toISOString())
      .lte("appointment_date", dayEnd.toISOString());
    if (doctorId) q = q.eq("doctor_id", doctorId);
    const { data: booked, error: bookedErr } = await q;
    if (bookedErr) {
      return new Response(
        JSON.stringify({ ok: false, error: bookedErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const bookedTimes = new Set((booked || []).map((b) => new Date(b.appointment_date).toISOString()));

    // Generate slots from clinic open to close
    const slots: string[] = [];
    const dayForSlots = new Date(targetDate);
    dayForSlots.setHours(CLINIC_OPEN, 0, 0, 0);
    const closeAt = new Date(targetDate);
    closeAt.setHours(CLINIC_CLOSE, 0, 0, 0);
    while (dayForSlots < closeAt) {
      const iso = dayForSlots.toISOString();
      if (!bookedTimes.has(iso)) slots.push(iso);
      dayForSlots.setMinutes(dayForSlots.getMinutes() + SLOT_MINUTES);
    }

    // List active doctors (so caller knows who can take the slot)
    let docQ = supabase.from("doctors").select("id, name, specialty").eq("active", true);
    if (doctorId) docQ = docQ.eq("id", doctorId);
    const { data: doctors } = await docQ.order("name", { ascending: true });

    await supabase.from("ai_logs").insert({
      action: "check_availability_api",
      payload: { date: dateParam, doctor_id: doctorId },
      result: { available_count: slots.length },
      status: "success",
      message: `${slots.length} available slot(s) on ${dateParam || "today"}`,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        date: dateParam || new Date().toISOString().slice(0, 10),
        slot_minutes: SLOT_MINUTES,
        clinic_hours: `${CLINIC_OPEN}:00-${CLINIC_CLOSE}:00`,
        available_slots: slots,
        count: slots.length,
        doctors: doctors || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
