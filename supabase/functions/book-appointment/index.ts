import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Patient fields
    const patientName = String(body.patient_name || "").trim();
    const patientPhone = body.patient_phone ? String(body.patient_phone).trim() : null;
    const patientEmail = body.patient_email ? String(body.patient_email).trim() : null;
    const gender = body.gender ? String(body.gender) : null;
    const birthDate = body.birth_date ? String(body.birth_date) : null;
    const address = body.address ? String(body.address) : null;
    const medicalHistory = body.medical_history ? String(body.medical_history) : null;

    if (!patientName) {
      return new Response(
        JSON.stringify({ ok: false, error: "patient_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Appointment fields
    const appointmentDateRaw = body.appointment_date ? String(body.appointment_date) : "";
    const doctorId = body.doctor_id ? String(body.doctor_id) : null;
    const serviceIdsRaw = body.service_ids;
    const notes = body.notes ? String(body.notes) : null;

    // 1) Create the patient
    const { data: patient, error: patientErr } = await supabase
      .from("patients")
      .insert({
        name: patientName,
        phone: patientPhone,
        email: patientEmail,
        gender,
        birth_date: birthDate,
        address,
        medical_history: medicalHistory,
      })
      .select("id, name, phone")
      .single();

    if (patientErr || !patient) {
      return new Response(
        JSON.stringify({ ok: false, error: patientErr?.message || "Failed to create patient" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Optionally book an appointment
    let appointment: Record<string, unknown> | null = null;
    if (appointmentDateRaw) {
      const apptDate = new Date(appointmentDateRaw);
      if (Number.isNaN(apptDate.getTime())) {
        return new Response(
          JSON.stringify({ ok: false, error: "Invalid appointment_date format. Use ISO 8601 (e.g. 2026-10-30T10:00:00Z)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Conflict check: same doctor + overlapping time (default 30 min slot)
      if (doctorId) {
        const slotMinutes = 30;
        const slotStart = apptDate.toISOString();
        const slotEnd = new Date(apptDate.getTime() + slotMinutes * 60000).toISOString();
        const { data: conflicts } = await supabase
          .from("appointments")
          .select("id")
          .eq("doctor_id", doctorId)
          .in("status", ["pending", "confirmed"])
          .gte("appointment_date", slotStart)
          .lt("appointment_date", slotEnd)
          .limit(1);
        if (conflicts && conflicts.length > 0) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "The doctor already has an appointment at that time",
              patient,
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          patient_id: patient.id,
          doctor_id: doctorId,
          appointment_date: apptDate.toISOString(),
          status: "pending",
          source: "ai",
          notes,
        })
        .select("id, appointment_date, status, doctor_id")
        .single();

      if (apptErr || !appt) {
        return new Response(
          JSON.stringify({ ok: false, error: apptErr?.message || "Failed to book appointment", patient }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      appointment = appt as Record<string, unknown>;

      // Link services if provided
      const serviceIds: string[] = Array.isArray(serviceIdsRaw)
        ? serviceIdsRaw.map((s: unknown) => String(s)).filter(Boolean)
        : [];
      if (serviceIds.length > 0) {
        const links = serviceIds.map((sid) => ({ appointment_id: appt.id, service_id: sid }));
        await supabase.from("appointment_services").insert(links);
      }
    }

    // 3) Log
    await supabase.from("ai_logs").insert({
      action: "book_appointment_api",
      payload: body,
      result: { patient_id: patient.id, appointment_id: appointment?.id ?? null },
      status: "success",
      message: `Patient ${patient.name} registered${appointment ? " + appointment booked" : ""}`,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        patient,
        appointment,
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
