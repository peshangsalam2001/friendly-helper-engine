import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock, PlayCircle, CheckCircle2, Users, User } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import peshangLogo from "@/assets/peshang-logo.jpg.asset.json";

export const Route = createFileRoute("/courses/$courseId")({
  component: CoursePage,
});

function resolveVideo(url: string | null | undefined): { kind: "iframe" | "video"; src: string } | null {
  if (!url) return null;
  const u = url.trim();
  const drive = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([a-zA-Z0-9_-]+)/);
  if (drive) return { kind: "iframe", src: `https://drive.google.com/file/d/${drive[1]}/preview` };
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (vimeo) {
    const params = new URLSearchParams({
      title: "0",
      byline: "0",
      portrait: "0",
      badge: "0",
      pip: "0",
      dnt: "1",
    });
    if (vimeo[2]) params.set("h", vimeo[2]);
    return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}?${params.toString()}` };
  }
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u)) return { kind: "video", src: u };
  return { kind: "iframe", src: u };
}

function resolveDownload(url: string | null | undefined): string | null {
  if (!url) return null;
  const drive = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([a-zA-Z0-9_-]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  return url;
}

function CoursePage() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      if (msg.includes("insufficient_balance")) toast.error(
        <span>
          باڵانسی پێویستت نیە. تکایە باڵانسەکەت پڕبکەرەوە{" "}
          <Link to="/topup" className="text-base font-extrabold text-sky-600 underline underline-offset-2 dark:text-sky-400">لێرە</Link>
        </span>
      );
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

  return (
    <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <div className="relative h-full w-full">
          {(() => {
            const v = canPlay ? resolveVideo(videoUrl) : null;
            if (current && v) {
              return v.kind === "video" ? (
                <video key={current.id} controls className="h-full w-full" src={v.src} />
              ) : (
                <>
                  <iframe
                    key={current.id}
                    src={v.src}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                  <img
                      src={peshangLogo.url}
                      alt=""
                      aria-hidden="true"
                      onClick={(e) => e.preventDefault()}
                      className="absolute right-0 top-0 h-14 w-14 cursor-default object-cover"
                    />
                </>
              );
            }
            return (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
                <Lock className="h-12 w-12" />
                <p>بۆ بینینی وانەکان پێویستە کۆرسەکە بکڕیت</p>
              </div>
            );
          })()}
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          {canPlay && videoUrl && (
            <div className="mt-3">
              <a
                href={resolveDownload(videoUrl) ?? videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                داگرتنی ڤیدیۆ
              </a>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {course.teacher && <span className="flex items-center gap-1"><User className="h-4 w-4" /> مامۆستا: {course.teacher}</span>}
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {(buyerCount ?? 0).toLocaleString()} قوتابی</span>
            <span>{lessons?.length ?? 0} وانە</span>
          </div>
          <p className="mt-3 whitespace-pre-line text-muted-foreground">{course.description}</p>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="text-sm text-muted-foreground">نرخی کۆرس</div>
            <div className="text-3xl font-bold text-primary">5,000 د.ع</div>
            {enrolled ? (
              <Button disabled className="w-full gap-2"><CheckCircle2 className="h-4 w-4" /> کڕاوە</Button>
            ) : !user ? (
              <Button className="w-full" onClick={() => navigate({ to: "/auth", search: { mode: "signin" } })}>
                داخڵبە بۆ کڕین
              </Button>
            ) : (
              <Button className="w-full" disabled={purchase.isPending} onClick={() => setConfirmOpen(true)}>
                {purchase.isPending ? "چاوەڕێبە..." : "کڕینی کۆرس"}
              </Button>
            )}
            {!enrolled && user && (
              <Link to="/topup"><Button variant="outline" className="w-full">زیادکردنی باڵانس</Button></Link>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ئایا دڵنیایت ئەم کۆرسە بکڕیت؟</AlertDialogTitle>
              <AlertDialogDescription>دوای کڕین بڕی کۆرسەکە لە باڵانسەکەت کەم دەکرێتەوە.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>نەخێر</AlertDialogCancel>
              <AlertDialogAction onClick={() => purchase.mutate()}>بەڵێ دڵنیام</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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