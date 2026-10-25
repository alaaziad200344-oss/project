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

    // Parse query params: ?format=csv|json|table&include_inactive=true&search=...
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "json").toLowerCase();
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
      payload: { format, include_inactive: includeInactive, search },
      result: { count: rows.length },
      status: "success",
      message: `${rows.length} service(s) returned as ${format}`,
    });

    if (format === "csv") {
      const header = "id,name,description,price,duration_minutes,active,created_at";
      const body = rows
        .map((r) =>
          [
            r.id,
            `"${(r.name || "").replace(/"/g, '""')}"`,
            `"${(r.description || "").replace(/"/g, '""')}"`,
            r.price,
            r.duration_minutes,
            r.active ? "true" : "false",
            r.created_at,
          ].join(",")
        )
        .join("\n");
      return new Response(header + "\n" + body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="services.csv"',
        },
      });
    }

    if (format === "table") {
      return new Response(
        JSON.stringify({
          ok: true,
          columns: ["id", "name", "description", "price", "duration_minutes", "active", "created_at"],
          rows,
          count: rows.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, services: rows, count: rows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
