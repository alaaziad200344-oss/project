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
    const includeInactive = url.searchParams.get("include_inactive") === "true";
    const search = url.searchParams.get("search")?.trim() || "";

    let query = supabase
      .from("services")
      .select("id, name, description, price, duration_minutes, active, created_at")
      .order("name", { ascending: true });
    if (!includeInactive) query = query.eq("active", true);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data: services, error } = await query;
    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = (services || []) as Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      duration_minutes: number;
      active: boolean;
      created_at: string;
    }>;

    // Log the call for auditability
    await supabase.from("ai_logs").insert({
      action: "list_services_api",
      payload: { include_inactive: includeInactive, search },
      result: { count: rows.length },
      status: "success",
      message: `${rows.length} service(s) returned`,
    });

    // Always return a clean JSON array of rows, ready to use as a table in n8n.
    return new Response(
      JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          price: Number(r.price),
          duration_minutes: r.duration_minutes,
          active: r.active,
          created_at: r.created_at,
        }))
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
