import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, User } from "lucide-react";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "کۆرسەکان — فێرگە" },
      { name: "description", content: "لیستی هەموو کۆرسە بەردەستەکان." },
    ],
  }),
  component: CoursesList,
});

function CoursesList() {
  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, price, thumbnail_url, teacher, lessons(count)")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">کۆرسەکان</h1>
      <p className="mb-8 text-muted-foreground">کۆرسێک هەڵبژێرە و بە باڵانسەکەت بیکڕە</p>
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-72 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : !courses?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          هێشتا کۆرس بەردەست نییە
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c: any) => {
            const lessonCount = c.lessons?.[0]?.count ?? 0;
            return (
            <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }}>
              <Card className="h-full overflow-hidden transition hover:border-primary hover:shadow-lg">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary">
                  {c.thumbnail_url && <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <CardContent className="space-y-2 p-5">
                  <h3 className="line-clamp-1 font-bold">{c.title}</h3>
                  <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{c.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.teacher && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {c.teacher}</span>}
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {lessonCount} وانە</span>
                    <BuyerCount courseId={c.id} />
                  </div>
                  <div className="font-bold text-primary">{Number(c.price).toLocaleString()} د.ع</div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
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