import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, PlayCircle, CheckCircle2, Users, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/courses/$courseId")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  const { data: course, isLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses").select("*").eq("id", courseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,course_id,title,description,duration_seconds,order_index,is_preview")
        .eq("course_id", courseId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: buyerCount } = useQuery({
    queryKey: ["buyer-count", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_buyer_count", { _course_id: courseId });
      if (error) throw error;
      return data as number;
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", user?.id, courseId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments").select("id")
        .eq("user_id", user!.id).eq("course_id", courseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const purchase = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("purchase_course", { _course_id: courseId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("کۆرسەکە بە سەرکەوتوویی کڕدرا!");
      qc.invalidateQueries({ queryKey: ["enrollment"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => {
      const msg = e.message || "";
      if (msg.includes("insufficient_balance")) toast.error("باڵانست بەس نییە. تکایە یەکەم باڵانس زیاد بکە.");
      else if (msg.includes("already_enrolled")) toast.info("پێشتر ئەم کۆرسەت کڕیوە.");
      else toast.error("هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵبدەرەوە.");
    },
  });

  const enrolled = !!enrollment;
  const current = lessons?.find(l => l.id === activeLesson) ?? lessons?.[0];
  const canPlay = !!current && (enrolled || current.is_preview);

  const { data: videoUrl } = useQuery({
    queryKey: ["lesson-video", current?.id, enrolled],
    enabled: canPlay,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lesson_video", { _lesson_id: current!.id });
      if (error) throw error;
      return data as string | null;
    },
  });

  if (isLoading) return <div className="container mx-auto p-10">چاوەڕێبە...</div>;
  if (!course) return <div className="container mx-auto p-10">کۆرسەکە نەدۆزرایەوە</div>;

  const totalSec = (lessons ?? []).reduce((s, l) => s + (l.duration_seconds || 0), 0);
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h} کاتژمێر ${m} خولەک` : `${m} خولەک`;
  };

  return (
    <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          {current && (enrolled || current.is_preview) && videoUrl ? (
            <video key={current.id} controls className="h-full w-full" src={videoUrl} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
              <Lock className="h-12 w-12" />
              <p>بۆ بینینی وانەکان پێویستە کۆرسەکە بکڕیت</p>
            </div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {course.teacher && <span className="flex items-center gap-1"><User className="h-4 w-4" /> مامۆستا: {course.teacher}</span>}
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {(buyerCount ?? 0).toLocaleString()} قوتابی</span>
            {totalSec > 0 && <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> کۆی درێژی: {fmt(totalSec)}</span>}
            <span>{lessons?.length ?? 0} وانە</span>
          </div>
          <p className="mt-3 whitespace-pre-line text-muted-foreground">{course.description}</p>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="text-sm text-muted-foreground">نرخی کۆرس</div>
            <div className="text-3xl font-bold text-primary">{Number(course.price).toLocaleString()} د.ع</div>
            {enrolled ? (
              <Button disabled className="w-full gap-2"><CheckCircle2 className="h-4 w-4" /> کڕاوە</Button>
            ) : !user ? (
              <Button className="w-full" onClick={() => navigate({ to: "/auth", search: { mode: "signin" } })}>
                داخڵبە بۆ کڕین
              </Button>
            ) : (
              <Button className="w-full" disabled={purchase.isPending} onClick={() => purchase.mutate()}>
                {purchase.isPending ? "چاوەڕێبە..." : "کڕینی کۆرس"}
              </Button>
            )}
            {!enrolled && user && (
              <Link to="/topup"><Button variant="outline" className="w-full">زیادکردنی باڵانس</Button></Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="mb-2 px-2 text-sm font-semibold">وانەکان ({lessons?.length ?? 0})</div>
            <div className="space-y-1">
              {lessons?.map((l, i) => {
                const open = enrolled || l.is_preview;
                const Btn = (
                  <button
                    key={l.id}
                    onClick={() => open && setActiveLesson(l.id)}
                    disabled={!open}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-right text-sm transition ${
                      current?.id === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    } ${!open && "opacity-60"}`}
                  >
                    <span className="flex items-center gap-2">
                      {open ? <PlayCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      <span>{i + 1}. {l.title}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {l.duration_seconds ? <span className="text-xs text-muted-foreground">{Math.round(l.duration_seconds/60)} خ</span> : null}
                      {l.is_preview && !enrolled && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">نموونە</span>}
                    </span>
                  </button>
                );
                return Btn;
              })}
              {!lessons?.length && <p className="p-3 text-sm text-muted-foreground">هێشتا وانە زیاد نەکراوە</p>}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}