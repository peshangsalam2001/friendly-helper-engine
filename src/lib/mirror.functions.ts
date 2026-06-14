import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = [
  "profiles",
  "user_roles",
  "courses",
  "lessons",
  "lesson_videos",
  "enrollments",
  "conversations",
  "conversation_participants",
  "chat_messages",
  "messages",
  "notifications",
  "notification_preferences",
  "topup_requests",
];

export const mirrorToExternalSupabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const mirrorUrl = process.env.MIRROR_SUPABASE_URL;
    const mirrorKey = process.env.MIRROR_SUPABASE_SERVICE_ROLE_KEY;
    if (!mirrorUrl || !mirrorKey) throw new Error("Mirror not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Record<string, { rows: number; error?: string }> = {};

    for (const table of TABLES) {
      try {
        const { data, error } = await (supabaseAdmin as any).from(table).select("*");
        if (error) throw error;
        const rows = data ?? [];
        if (rows.length === 0) {
          results[table] = { rows: 0 };
          continue;
        }
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const res = await fetch(`${mirrorUrl}/rest/v1/${table}`, {
            method: "POST",
            headers: {
              apikey: mirrorKey,
              Authorization: `Bearer ${mirrorKey}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(chunk),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`${res.status}: ${text.slice(0, 200)}`);
          }
        }
        results[table] = { rows: rows.length };
      } catch (e: unknown) {
        results[table] = { rows: 0, error: e instanceof Error ? e.message : String(e) };
      }
    }
    return { ok: true, results };
  });