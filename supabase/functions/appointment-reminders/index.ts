import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    // Window: how many days ahead to look (default 7)
    const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "7", 10) || 7, 1), 90);
    // Optional: exact date YYYY-MM-DD
    const dateParam = url.searchParams.get("date")?.trim() || "";
    // Optional: status filter (default pending+confirmed)
    const statusParam = url.searchParams.get("status")?.trim() || "";
    // Optional: only appointments not yet reminded
    const onlyUnreminded = url.searchParams.get("unreminded") === "true";

    // Build the date range
    const now = new Date();
    const rangeStart = dateParam
      ? new Date(dateParam + "T00:00:00")
      : new Date(now.getTime());
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(rangeStart);
    if (dateParam) {
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      rangeEnd.setDate(rangeEnd.getDate() + days);
      rangeEnd.setHours(23, 59, 59, 999);
    }

    // Fetch appointments with patient + doctor info
    let q = supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        status,
        notes,
        patient_id,
        doctor_id,
        patients:patient_id ( id, name, phone, email ),
        doctors:doctor_id ( id, name, specialty )
      `)
      .gte("appointment_date", rangeStart.toISOString())
      .lte("appointment_date", rangeEnd.toISOString())
      .order("appointment_date", { ascending: true });

    const statusList = statusParam
      ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
      : ["pending", "confirmed"];
    q = q.in("status", statusList);

    const { data: appts, error } = await q;
    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch which appointments already have a reminder log
    let remindedIds = new Set<string>();
    if (onlyUnreminded) {
      const apptIds = (appts || []).map((a: { id: string }) => a.id);
      if (apptIds.length > 0) {
        const { data: logs } = await supabase
          .from("ai_logs")
          .select("payload")
          .eq("action", "appointment_reminder_sent")
          .in("payload->>appointment_id", apptIds);
        (logs || []).forEach((l: { payload: { appointment_id?: string } }) => {
          const pid = l.payload?.appointment_id;
          if (pid) remindedIds.add(pid);
        });
      }
    }

    // Format each appointment as a reminder payload
    const reminders = (appts || [])
      .filter((a: { id: string }) => !onlyUnreminded || !remindedIds.has(a.id))
      .map((a: {
        id: string;
        appointment_date: string;
        status: string;
        notes: string | null;
        patient_id: string;
        doctor_id: string | null;
        patients: { id: string; name: string; phone: string | null; email: string | null } | { id: string; name: string; phone: string | null; email: string | null }[];
        doctors: { id: string; name: string; specialty: string | null } | { id: string; name: string; specialty: string | null }[] | null;
      }) => {
        const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
        const doctor = Array.isArray(a.doctors) ? (a.doctors[0] || null) : a.doctors;
        const apptDate = new Date(a.appointment_date);
        return {
          appointment_id: a.id,
          patient_id: a.patient_id,
          patient_name: patient?.name || "",
          patient_phone: patient?.phone || null,
          patient_email: patient?.email || null,
          doctor_name: doctor?.name || null,
          doctor_specialty: doctor?.specialty || null,
          appointment_date: a.appointment_date,
          appointment_date_ar: apptDate.toLocaleDateString("ar-EG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          appointment_time: apptDate.toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          status: a.status,
          notes: a.notes,
          reminder_message: patient?.phone
            ? `مرحباً ${patient.name}، نذكّرك بموعدك في عيادة الأسنان يوم ${apptDate.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })} الساعة ${apptDate.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true })}${doctor?.name ? ` مع ${doctor.name}` : ""}. نتمنى حضورك في الموعد.`
            : null,
        };
      });

    // Log the call
    await supabase.from("ai_logs").insert({
      action: "appointment_reminders_fetch",
      payload: { days, date: dateParam, status: statusList, unreminded: onlyUnreminded },
      result: { count: reminders.length },
      status: "success",
      message: `${reminders.length} reminder(s) fetched`,
    });

    // Return a clean JSON array of rows (each appointment = one object), like services-api
    return new Response(
      JSON.stringify(reminders),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
