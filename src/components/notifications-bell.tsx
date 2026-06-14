import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";

const sb = supabase as any;

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as Notif[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unread = (notifs || []).filter(n => !n.is_read).length;

  const markAll = useMutation({
    mutationFn: async () => { await sb.rpc("mark_all_notifications_read"); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="ئاگاداری">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="font-semibold">ئاگادارییەکان</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => markAll.mutate()}>
              <Check className="h-3 w-3" /> هەمووی خوێندرایەوە
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!notifs?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">هیچ ئاگادارییەک نییە</p>
          ) : notifs.map(n => {
            const content = (
              <div className={`border-b p-3 hover:bg-muted ${!n.is_read ? "bg-primary/5" : ""}`}>
                <div className="text-sm font-semibold">{n.title}</div>
                {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            );
            return n.link ? <Link key={n.id} to={n.link as any}>{content}</Link> : <div key={n.id}>{content}</div>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}