import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth, useProfile } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, BookOpen, Mail } from "lucide-react";

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
        .from("topup_requests").select("*").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">{profile?.full_name || "هەژمارەکەم"}</h1>
      <p className="mb-8 text-muted-foreground">{user?.email}</p>

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
                  {t.status === "approved" ? "پەسەند کرا" : t.status === "rejected" ? "ڕەتکرایەوە" : "چاوەڕێ"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </div>
  );
}