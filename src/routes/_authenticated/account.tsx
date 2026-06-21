import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, useProfile } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, BookOpen, Mail, Bell, AtSign, Phone, User as UserIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/account")({
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const { data: profile } = useProfile();

  const { data: enrollments } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, created_at, course:courses(id,title,thumbnail_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: topups } = useQuery({
    queryKey: ["my-topups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topup_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <Card className="mb-8 overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-3xl font-bold text-primary-foreground shadow-lg ring-4 ring-background">
              {(profile?.full_name || profile?.username || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{profile?.full_name || "هەژمارەکەم"}</h1>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-3 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <AtSign className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">نازناو</div>
                <div className="truncate font-semibold">{profile?.username || "—"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-3 backdrop-blur">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Phone className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">ژمارەی مۆبایل</div>
                <div dir="ltr" className="truncate text-right font-semibold">{profile?.phone || "—"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <Wallet className="mb-2 h-5 w-5 text-primary" />
          <div className="text-xs text-muted-foreground">باڵانس</div>
          <div className="text-2xl font-bold">{Number(profile?.balance ?? 0).toLocaleString()} د.ع</div>
          <Link to="/topup"><Button size="sm" className="mt-3 w-full">زیادکردن</Button></Link>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <BookOpen className="mb-2 h-5 w-5 text-primary" />
          <div className="text-xs text-muted-foreground">کۆرسەکانم</div>
          <div className="text-2xl font-bold">{enrollments?.length ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <Mail className="mb-2 h-5 w-5 text-primary" />
          <div className="text-xs text-muted-foreground">نامەکان</div>
          <Link to="/messages"><Button size="sm" variant="outline" className="mt-3 w-full">بینین</Button></Link>
        </CardContent></Card>
      </div>

      <h2 className="mb-3 text-xl font-bold">کۆرسەکانی من</h2>
      {!enrollments?.length ? (
        <div className="mb-8 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          هێشتا کۆرسێکت نەکڕیوە — <Link to="/courses" className="text-primary underline">بڕۆ بۆ کۆرسەکان</Link>
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e: any) => (
            <Link key={e.id} to="/courses/$courseId" params={{ courseId: e.course.id }}>
              <Card className="overflow-hidden transition hover:border-primary">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary">
                  {e.course.thumbnail_url && <img src={e.course.thumbnail_url} alt={e.course.title} className="h-full w-full object-cover" />}
                </div>
                <CardContent className="p-4 font-semibold">{e.course.title}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-xl font-bold">داواکارییەکانی زیادکردنی باڵانس</h2>
      <Card><CardContent className="p-0">
        {!topups?.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">هیچ داواکارییەک نییە</p>
        ) : (
          <ul className="divide-y">
            {topups.map(t => (
              <li key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">{Number(t.amount).toLocaleString()} د.ع</div>
                  <div className="text-xs text-muted-foreground">{t.method.toUpperCase()} • {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  t.status === "approved" ? "bg-green-100 text-green-700" :
                  t.status === "rejected" ? "bg-red-100 text-red-700" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {t.status === "approved" ? "قبوڵکرا" : t.status === "rejected" ? "ڕەتکرایەوە" : "چاوەڕێبە تا قبوڵ ئەکرێت"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>

      <h2 className="mb-3 mt-8 text-xl font-bold flex items-center gap-2"><Bell className="h-5 w-5" /> ڕێکخستنی ئاگاداری</h2>
      <NotificationPrefs />
    </div>
  );
}

function NotificationPrefs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: prefs } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await sb.from("notification_preferences").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data || { user_id: user!.id, new_course: true, balance_update: true, announcement: true, chat_message: true };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const { error } = await sb.from("notification_preferences").upsert({ user_id: user!.id, ...prefs, ...patch });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notif-prefs"] }); toast.success("ڕێکخرا"); },
    onError: (e: any) => toast.error(e.message),
  });

  const rows: { key: string; label: string }[] = [
    { key: "new_course", label: "کۆرسی نوێ" },
    { key: "balance_update", label: "گۆڕانی باڵانس" },
    { key: "announcement", label: "ڕاگەیاندنەکان" },
    { key: "chat_message", label: "نامەی نوێ" },
  ];

  return (
    <Card><CardContent className="divide-y p-0">
      {rows.map(r => (
        <div key={r.key} className="flex items-center justify-between p-4">
          <span className="text-sm font-medium">{r.label}</span>
          <Switch
            checked={!!prefs?.[r.key]}
            onCheckedChange={(v) => update.mutate({ [r.key]: v })}
          />
        </div>
      ))}
    </CardContent></Card>
  );
}