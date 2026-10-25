import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AiPayload {
  action: string;
  data?: Record<string, unknown>;
}

type AiData = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Verify the API key from settings against the request's Authorization header.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const { data: keyRow } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "n8n_api_key")
      .maybeSingle();
    const expectedKey = (keyRow as { value: string } | null)?.value?.trim() || "";
    if (!expectedKey || token !== expectedKey) {
      await supabase.from("ai_logs").insert({
        action: "auth_failed",
        payload: { has_token: Boolean(token) },
        status: "error",
        message: "Invalid or missing API key",
      });
      return new Response(
        JSON.stringify({ ok: false, status: "error", message: "Unauthorized: invalid or missing API key", result: null }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as AiPayload;
    const action = (body.action || "").toLowerCase();
    const data = (body.data || {}) as AiData;

    let result: Record<string, unknown> = {};
    let status: "success" | "error" = "success";
    let message = "";

    switch (action) {
      case "register_patient": {
        if (!data.name) {
          status = "error";
          message = "name is required";
          break;
        }
        const { data: patient, error } = await supabase
          .from("patients")
          .insert({
            name: data.name,
            phone: data.phone || null,
            email: data.email || null,
            gender: data.gender || null,
            birth_date: data.birth_date || null,
            address: data.address || null,
            medical_history: data.medical_history || null,
            notes: data.notes || null,
          })
          .select()
          .single();
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { patient };
          message = "Patient registered";
        }
        break;
      }

      case "find_patient": {
        const query = String(data.phone || data.name || "");
        if (!query) {
          status = "error";
          message = "phone or name is required to find a patient";
          break;
        }
        let q = supabase.from("patients").select("*");
        if (data.phone) q = q.ilike("phone", `%${data.phone}%`);
        else if (data.name) q = q.ilike("name", `%${data.name}%`);
        const { data: patients, error } = await q.limit(20);
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { patients };
          message = `${patients?.length || 0} patient(s) found`;
        }
        break;
      }

      case "book_appointment": {
        if (!data.patient_id || !data.appointment_date) {
          status = "error";
          message = "patient_id and appointment_date are required";
          break;
        }
        const { data: appt, error } = await supabase
          .from("appointments")
          .insert({
            patient_id: data.patient_id,
            doctor_id: data.doctor_id || null,
            appointment_date: data.appointment_date,
            status: "pending",
            notes: data.notes || null,
            source: "ai",
          })
          .select()
          .single();
        if (error) {
          status = "error";
          message = error.message;
        } else {
          let servicesLinked: string[] = [];
          if (Array.isArray(data.service_ids) && data.service_ids.length) {
            const apptId = (appt as { id: string }).id;
            const rows = (data.service_ids as string[]).map((sid) => ({
              appointment_id: apptId,
              service_id: sid,
            }));
            await supabase.from("appointment_services").insert(rows);
            servicesLinked = data.service_ids as string[];
          }
          result = { appointment: appt, services_linked: servicesLinked };
          message = "Appointment booked";
        }
        break;
      }

      case "confirm_appointment": {
        if (!data.appointment_id) {
          status = "error";
          message = "appointment_id is required";
          break;
        }
        const { data: appt, error } = await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", data.appointment_id)
          .select()
          .single();
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { appointment: appt };
          message = "Appointment confirmed";
        }
        break;
      }

      case "cancel_appointment": {
        if (!data.appointment_id) {
          status = "error";
          message = "appointment_id is required";
          break;
        }
        const { data: appt, error } = await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("id", data.appointment_id)
          .select()
          .single();
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { appointment: appt };
          message = "Appointment cancelled";
        }
        break;
      }

      case "list_appointments": {
        let q = supabase
          .from("appointments")
          .select(
            "id, appointment_date, status, notes, source, patients(name, phone), doctors(name, specialty)"
          )
          .order("appointment_date", { ascending: true });
        if (data.status) q = q.eq("status", data.status);
        if (data.from) q = q.gte("appointment_date", data.from);
        if (data.to) q = q.lte("appointment_date", data.to);
        const { data: appts, error } = await q.limit(100);
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { appointments: appts };
          message = `${appts?.length || 0} appointment(s)`;
        }
        break;
      }

      case "list_services": {
        let q = supabase
          .from("services")
          .select("id, name, description, price, duration_minutes, active")
          .order("name", { ascending: true });
        if (!data.include_inactive) q = q.eq("active", true);
        if (data.search) q = q.ilike("name", `%${data.search}%`);
        const { data: services, error } = await q.limit(data.limit ? Number(data.limit) : 1000);
        if (error) {
          status = "error";
          message = error.message;
        } else {
          const rows = (services || []) as Array<{
            id: string;
            name: string;
            description: string | null;
            price: number;
            duration_minutes: number;
            active: boolean;
          }>;
          if (data.format === "csv") {
            const header = "id,name,description,price,duration_minutes,active";
            const body = rows
              .map((r) =>
                [
                  r.id,
                  `"${(r.name || "").replace(/"/g, '""')}"`,
                  `"${(r.description || "").replace(/"/g, '""')}"`,
                  r.price,
                  r.duration_minutes,
                  r.active ? "true" : "false",
                ].join(",")
              )
              .join("\n");
            result = { csv: header + "\n" + body, count: rows.length };
            message = `${rows.length} service(s) as CSV`;
          } else if (data.format === "table") {
            result = {
              columns: ["id", "name", "description", "price", "duration_minutes", "active"],
              rows,
              count: rows.length,
            };
            message = `${rows.length} service(s) as table`;
          } else {
            result = { services: rows, count: rows.length };
            message = `${rows.length} service(s)`;
          }
        }
        break;
      }

      case "list_doctors": {
        const { data: doctors, error } = await supabase
          .from("doctors")
          .select("id, name, specialty, phone, email, active")
          .eq("active", true)
          .order("name", { ascending: true });
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { doctors };
          message = `${doctors?.length || 0} doctor(s)`;
        }
        break;
      }

      case "record_visit": {
        if (!data.patient_id) {
          status = "error";
          message = "patient_id is required";
          break;
        }
        const { data: visit, error } = await supabase
          .from("visits")
          .insert({
            patient_id: data.patient_id,
            doctor_id: data.doctor_id || null,
            appointment_id: data.appointment_id || null,
            visit_date: data.visit_date || new Date().toISOString(),
            diagnosis: data.diagnosis || null,
            treatment: data.treatment || null,
            prescription: data.prescription || null,
            cost: data.cost || 0,
            notes: data.notes || null,
          })
          .select()
          .single();
        if (error) {
          status = "error";
          message = error.message;
        } else {
          result = { visit };
          message = "Visit recorded";
        }
        break;
      }

      case "patient_history": {
        if (!data.patient_id) {
          status = "error";
          message = "patient_id is required";
          break;
        }
        const { data: visits, error: vErr } = await supabase
          .from("visits")
          .select("id, visit_date, diagnosis, treatment, prescription, cost, notes, doctors(name)")
          .eq("patient_id", data.patient_id)
          .order("visit_date", { ascending: false });
        const { data: appts, error: aErr } = await supabase
          .from("appointments")
          .select("id, appointment_date, status, notes, doctors(name, specialty)")
          .eq("patient_id", data.patient_id)
          .order("appointment_date", { ascending: false });
        if (vErr || aErr) {
          status = "error";
          message = vErr?.message || aErr?.message || "unknown error";
        } else {
          result = { visits, appointments: appts };
          message = `History for patient ${data.patient_id}`;
        }
        break;
      }

      default:
        status = "error";
        message = `Unknown action: ${action}. Supported: register_patient, find_patient, book_appointment, confirm_appointment, cancel_appointment, list_appointments, list_services (supports format=csv|table, include_inactive, search), list_doctors, record_visit, patient_history`;
    }

    await supabase.from("ai_logs").insert({
      action,
      payload: body,
      result: status === "success" ? result : null,
      status,
      message,
    });

    return new Response(
      JSON.stringify({ ok: status === "success", status, message, result }),
      {
        status: status === "error" ? 400 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, status: "error", message: (err as Error).message, result: null }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
