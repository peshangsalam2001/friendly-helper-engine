import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Wallet, ShieldCheck, PlayCircle, Users, BookOpen, User, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ئەکادیمیای پێشەنگ — Peshang Academy" },
      { name: "description", content: "ئەکادیمیای پێشەنگ — کۆرسی ڤیدیۆیی بە زمانی کوردی. کۆرس بکڕە و فێربە." },
      { property: "og:title", content: "ئەکادیمیای پێشەنگ — Peshang Academy" },
      { property: "og:description", content: "کۆرسی ڤیدیۆیی بە زمانی کوردی." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const { data: courses } = useQuery({
    queryKey: ["featured-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
          .select("id, title, description, price, thumbnail_url, teacher, lessons(count)")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.course_id as string));
    },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-gradient-to-bl from-primary/10 via-background to-background">
          <div className="container mx-auto grid gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
                ئەکادیمیای پێشەنگ — کۆرسی ئۆنلاین بە زمانی شیرینی کوردی
              </div>
              <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
                فێربە، بەرەوپێش بچۆ —<br />
                لە هەر کاتێک و لە هەر شوێنێک
              </h1>
              <p className="text-lg text-muted-foreground">
                کۆرسی تایبەت بە چەندین بوار. باڵانسەکەت زیاد بکە بە ئێف ئایبی، فاستپەی یاخود سوپەرکی،
                دواتر کۆرسی دڵخوازت بکڕە.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/courses"><Button size="lg">بینینی کۆرسەکان</Button></Link>
                <Link to="/guide"><Button size="lg" variant="outline">چۆن کاردەکات؟</Button></Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { icon: PlayCircle, t: "بەرزترین کوالیتی", d: "وانەکان بە بەرزترین کوالیتی دادەنرێن" },
                { icon: Wallet, t: "باڵانس", d: "زیادکردنی باڵانس لەڕێگەی FIB ، Fastpay ، SuperQi" },
                { icon: ShieldCheck, t: "پارێزراو", d: "گرەنتی پاراستنی هەژمارەکەت و پارەکانت دەکەین" },
              ].map((f) => (
                <Card key={f.t} className="border-primary/10">
                  <CardContent className="space-y-2 p-5">
                    <f.icon className="h-6 w-6 text-primary" />
                    <div className="font-semibold">{f.t}</div>
                    <div className="text-sm text-muted-foreground">{f.d}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">کۆرسە تازەکان</h2>
              <p className="text-muted-foreground">نوێترین وانەکانی پلاتفۆڕم</p>
            </div>
            <Link to="/courses"><Button variant="ghost">بینینی هەموو کۆرسەکان ←</Button></Link>
          </div>
          {!courses?.length ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              هێشتا هیچ کۆرسێک زیاد نەکراوە
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c: any) => {
                const lessonCount = c.lessons?.[0]?.count ?? 0;
                const owned = myEnrollments?.has(c.id) ?? false;
                return (
                <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }}>
                  <Card className="h-full overflow-hidden transition hover:border-primary hover:shadow-lg">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary">
                      {c.thumbnail_url && (
                        <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <CardContent className="space-y-2 p-5">
                      <h3 className="line-clamp-1 font-bold">{c.title}</h3>
                      <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{c.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {c.teacher && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {c.teacher}</span>}
                        <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {lessonCount} وانە</span>
                        <BuyerCount courseId={c.id} />
                      </div>
                      {owned ? (
                        <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> کڕاوە
                        </div>
                      ) : (
                        <div className="font-bold text-primary">5,000 د.ع</div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function BuyerCount({ courseId }: { courseId: string }) {
  const { data } = useQuery({
    queryKey: ["buyer-count", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_buyer_count", { _course_id: courseId });
      if (error) throw error;
      return data as number;
    },
  });
  return (
    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(data ?? 0).toLocaleString()} قوتابی</span>
  );
}
