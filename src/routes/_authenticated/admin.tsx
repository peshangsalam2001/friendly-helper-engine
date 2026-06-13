import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    const { data: role } = await supabase.from("user_roles").select("role")
      .eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: Admin,
});

function Admin() {
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">پانێڵی ئەدمین</h1>
      <Tabs defaultValue="topups">
        <TabsList>
          <TabsTrigger value="topups">داواکاری باڵانس</TabsTrigger>
          <TabsTrigger value="courses">کۆرسەکان</TabsTrigger>
          <TabsTrigger value="lessons">وانەکان</TabsTrigger>
        </TabsList>
        <TabsContent value="topups" className="mt-6"><TopupsTab /></TabsContent>
        <TabsContent value="courses" className="mt-6"><CoursesTab /></TabsContent>
        <TabsContent value="lessons" className="mt-6"><LessonsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TopupsTab() {
  const qc = useQueryClient();
  const { data: topups } = useQuery({
    queryKey: ["admin-topups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topup_requests")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const review = useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc("review_topup", { _topup_id: id, _approve: approve, _admin_note: note });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-topups"] }); toast.success("کرا"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function viewProof(path: string | null) {
    if (!path) return;
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Card><CardContent className="p-0">
      {!topups?.length ? (
        <p className="p-6 text-center text-muted-foreground">هیچ داواکارییەک نییە</p>
      ) : (
        <ul className="divide-y">
          {topups.map(t => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-semibold">{Number(t.amount).toLocaleString()} د.ع — {t.method.toUpperCase()}</div>
                <div className="text-xs text-muted-foreground">بەکارهێنەر: {t.user_id.slice(0,8)} • {new Date(t.created_at).toLocaleString()}</div>
                {t.note && <div className="mt-1 text-sm">{t.note}</div>}
              </div>
              <div className="flex items-center gap-2">
                {t.proof_url && (
                  <Button size="sm" variant="outline" onClick={()=>viewProof(t.proof_url)}>
                    <ExternalLink className="ml-1 h-4 w-4" /> بەڵگە
                  </Button>
                )}
                {t.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={()=>review.mutate({ id: t.id, approve: true })}>
                      <Check className="ml-1 h-4 w-4" /> پەسەند
                    </Button>
                    <Button size="sm" variant="destructive" onClick={()=>review.mutate({ id: t.id, approve: false })}>
                      <X className="ml-1 h-4 w-4" /> ڕەتکردن
                    </Button>
                  </>
                ) : (
                  <span className={`rounded-full px-3 py-1 text-xs ${t.status==="approved"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>
                    {t.status==="approved"?"پەسەند":"ڕەتکراوە"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardContent></Card>
  );
}

function CoursesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", thumbnail_url: "" });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").insert({
        title: form.title, description: form.description,
        price: Number(form.price) || 0, thumbnail_url: form.thumbnail_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      setOpen(false); setForm({ title:"", description:"", price:"", thumbnail_url:"" });
      toast.success("کۆرس زیادکرا");
    },
    onError: (e:any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-courses"] }); toast.success("سڕایەوە"); },
  });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-1 h-4 w-4" /> کۆرسی نوێ</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>زیادکردنی کۆرس</DialogTitle></DialogHeader>
            <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="space-y-3">
              <div><Label>ناونیشان</Label><Input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
              <div><Label>وەسف</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={4} /></div>
              <div><Label>نرخ (د.ع)</Label><Input type="number" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})} /></div>
              <div><Label>بەستەری وێنە (ئیختیاری)</Label><Input value={form.thumbnail_url} onChange={e=>setForm({...form,thumbnail_url:e.target.value})} placeholder="https://..." /></div>
              <Button className="w-full" disabled={create.isPending}>زیادکردن</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        {!courses?.length ? (
          <p className="p-6 text-center text-muted-foreground">هیچ کۆرسێک نییە</p>
        ) : (
          <ul className="divide-y">
            {courses.map(c => (
              <li key={c.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{Number(c.price).toLocaleString()} د.ع</div>
                </div>
                <Button size="icon" variant="ghost" onClick={()=>del.mutate(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent></Card>
    </>
  );
}

function LessonsTab() {
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState<string>("");
  const [form, setForm] = useState({ title:"", video_url:"", order_index:"0", is_preview:false });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => (await supabase.from("courses").select("id,title")).data ?? [],
  });

  const { data: lessons } = useQuery({
    queryKey: ["admin-lessons", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase.from("lessons").select("id,course_id,title,description,duration_seconds,order_index,is_preview,created_at").eq("course_id", courseId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lessons").insert({
        course_id: courseId, title: form.title, video_url: form.video_url || null,
        order_index: Number(form.order_index)||0, is_preview: form.is_preview,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lessons"] });
      setForm({ title:"", video_url:"", order_index: String((lessons?.length ?? 0) + 1), is_preview:false });
      toast.success("وانە زیادکرا");
    },
    onError: (e:any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-lessons"] }); toast.success("سڕایەوە"); },
  });

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-3 p-5">
        <Label>کۆرس هەڵبژێرە</Label>
        <select className="w-full rounded-md border bg-background p-2" value={courseId} onChange={e=>setCourseId(e.target.value)}>
          <option value="">— هەڵبژێرە —</option>
          {courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </CardContent></Card>

      {courseId && (
        <>
          <Card><CardContent className="p-5">
            <h3 className="mb-3 font-bold">زیادکردنی وانە</h3>
            <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>ناونیشان</Label><Input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
              <div className="sm:col-span-2"><Label>بەستەری ڤیدیۆ</Label><Input value={form.video_url} onChange={e=>setForm({...form,video_url:e.target.value})} placeholder="https://..." /></div>
              <div><Label>ڕیزبەندی</Label><Input type="number" value={form.order_index} onChange={e=>setForm({...form,order_index:e.target.value})} /></div>
              <label className="flex items-end gap-2"><input type="checkbox" checked={form.is_preview} onChange={e=>setForm({...form,is_preview:e.target.checked})} /> نموونەی بێبەرامبەر</label>
              <Button className="sm:col-span-2" disabled={create.isPending}>زیادکردن</Button>
            </form>
          </CardContent></Card>

          <Card><CardContent className="p-0">
            {!lessons?.length ? (
              <p className="p-6 text-center text-muted-foreground">هێشتا وانە نییە</p>
            ) : (
              <ul className="divide-y">
                {lessons.map((l, i) => (
                  <li key={l.id} className="flex items-center justify-between p-4">
                    <div><span className="font-bold">{i+1}.</span> {l.title} {l.is_preview && <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">نموونە</span>}</div>
                    <Button size="icon" variant="ghost" onClick={()=>del.mutate(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </>
      )}
    </div>
  );
}