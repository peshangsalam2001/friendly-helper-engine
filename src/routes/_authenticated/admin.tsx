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
import { Plus, Trash2, ExternalLink, Check, X, Pencil, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { mirrorToExternalSupabase } from "@/lib/mirror.functions";

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
          <TabsTrigger value="mirror">Mirror</TabsTrigger>
        </TabsList>
        <TabsContent value="topups" className="mt-6"><TopupsTab /></TabsContent>
        <TabsContent value="courses" className="mt-6"><CoursesTab /></TabsContent>
        <TabsContent value="lessons" className="mt-6"><LessonsTab /></TabsContent>
        <TabsContent value="mirror" className="mt-6"><MirrorTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function MirrorTab() {
  const run = useServerFn(mirrorToExternalSupabase);
  const [result, setResult] = useState<Record<string, { rows: number; error?: string }> | null>(null);
  const m = useMutation({
    mutationFn: async () => await run(),
    onSuccess: (r: any) => { setResult(r.results); toast.success("Mirror done"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Card><CardContent className="space-y-4 p-6">
      <p className="text-sm text-muted-foreground">Copy all tables to your external Supabase (one-way, upsert).</p>
      <Button onClick={() => m.mutate()} disabled={m.isPending}>
        {m.isPending ? "Mirroring..." : "Run mirror now"}
      </Button>
      {result && (
        <div className="space-y-1 text-sm">
          {Object.entries(result).map(([t, r]) => (
            <div key={t} className={r.error ? "text-destructive" : ""}>
              {t}: {r.rows} rows {r.error ? `— ${r.error}` : "✓"}
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
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
  const [editing, setEditing] = useState<any | null>(null);
  const empty = { title: "", description: "", price: "", thumbnail_url: "", teacher: "", is_published: true };
  const [form, setForm] = useState<any>(empty);

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
      const payload = {
        title: form.title, description: form.description,
        price: Number(form.price) || 0,
        thumbnail_url: form.thumbnail_url || null,
        teacher: form.teacher || null,
        is_published: !!form.is_published,
      };
      if (editing) {
        const { error } = await supabase.from("courses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      setOpen(false); setEditing(null); setForm(empty);
      toast.success("پاشەکەوت کرا");
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
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(empty); }}>
              <Plus className="ml-1 h-4 w-4" /> کۆرسی نوێ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "دەستکاری کۆرس" : "زیادکردنی کۆرس"}</DialogTitle></DialogHeader>
            <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="space-y-3">
              <div><Label>ناونیشان</Label><Input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
              <div><Label>وەسف</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={4} /></div>
              <div><Label>مامۆستا</Label><Input value={form.teacher} onChange={e=>setForm({...form,teacher:e.target.value})} placeholder="ناوی مامۆستا" /></div>
              <div><Label>نرخ (د.ع)</Label><Input type="number" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})} /></div>
              <div>
                <Label>وێنە (ئیختیاری)</Label>
                <Input value={form.thumbnail_url} onChange={e=>setForm({...form,thumbnail_url:e.target.value})} placeholder="https://... یاخود وێنە بەرز بکەرەوە" />
                <ImageUploader onUploaded={(url)=>setForm({...form,thumbnail_url:url})} />
                {form.thumbnail_url && <img src={form.thumbnail_url} alt="" className="mt-2 h-24 rounded-md object-cover" />}
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})} /> بڵاوکراوەتەوە</label>
              <Button className="w-full" disabled={create.isPending}>{editing ? "پاشەکەوت" : "زیادکردن"}</Button>
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
                  <div className="font-semibold">{c.title} {!c.is_published && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">شاراوە</span>}</div>
                  <div className="text-xs text-muted-foreground">{Number(c.price).toLocaleString()} د.ع {c.teacher && `• ${c.teacher}`}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={()=>{ setEditing(c); setForm({ title:c.title, description:c.description||"", price:String(c.price), thumbnail_url:c.thumbnail_url||"", teacher:c.teacher||"", is_published:c.is_published }); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={()=>{ if(confirm("دڵنیایت؟")) del.mutate(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
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
  const emptyL = { id:"", title:"", description:"", video_url:"", order_index:"0", is_preview:false, duration_seconds:"0" };
  const [form, setForm] = useState<any>(emptyL);
  const editingL = !!form.id;

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
      const payload: any = {
        course_id: courseId, title: form.title,
        description: form.description || null,
        duration_seconds: Number(form.duration_seconds) || 0,
        order_index: Number(form.order_index)||0,
        is_preview: form.is_preview,
      };
      let lessonId = form.id;
      if (editingL) {
        const { error } = await supabase.from("lessons").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("lessons").insert(payload).select("id").single();
        if (error) throw error;
        lessonId = data.id;
      }
      if (form.video_url !== undefined && (form.video_url || editingL)) {
        const { error: vErr } = await (supabase as any).rpc("set_lesson_video", {
          _lesson_id: lessonId, _video_url: form.video_url || null,
        });
        if (vErr) throw vErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-lessons"] });
      setForm({ ...emptyL, order_index: String((lessons?.length ?? 0) + 1) });
      toast.success("پاشەکەوت کرا");
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

  const emptyRow = () => ({ title: "", description: "", video_url: "", duration_min: "", is_preview: false });
  const [bulkRows, setBulkRows] = useState<any[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [autoTitle, setAutoTitle] = useState("وانەی");
  const [startIndex, setStartIndex] = useState("");

  const bulkCreate = useMutation({
    mutationFn: async () => {
      const rows = bulkRows.filter(r => r.title.trim() || r.video_url.trim());
      if (!rows.length) throw new Error("هیچ وانەیەک نییە");
      const baseOrder = Number(startIndex) || ((lessons?.length ?? 0) + 1);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const title = r.title.trim() || `${autoTitle} ${baseOrder + i}`;
        const payload: any = {
          course_id: courseId,
          title,
          description: r.description || null,
          duration_seconds: Math.round((Number(r.duration_min) || 0) * 60),
          order_index: baseOrder + i,
          is_preview: !!r.is_preview,
        };
        const { data, error } = await supabase.from("lessons").insert(payload).select("id").single();
        if (error) throw error;
        if (r.video_url.trim()) {
          const { error: vErr } = await (supabase as any).rpc("set_lesson_video", {
            _lesson_id: data.id, _video_url: r.video_url.trim(),
          });
          if (vErr) throw vErr;
        }
      }
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["admin-lessons"] });
      setBulkRows([emptyRow(), emptyRow(), emptyRow()]);
      setStartIndex("");
      toast.success(`${n} وانە زیادکرا`);
    },
    onError: (e: any) => toast.error(e.message),
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
            <h3 className="mb-3 font-bold">{editingL ? "دەستکاری وانە" : "زیادکردنی وانە"}</h3>
            <form onSubmit={(e)=>{e.preventDefault(); create.mutate();}} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>ناونیشان</Label><Input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
              <div className="sm:col-span-2"><Label>وەسف</Label><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} /></div>
              <div className="sm:col-span-2"><Label>بەستەری ڤیدیۆ (Google Drive، YouTube، Vimeo، یاخود هەر بەستەرێکی ڤیدیۆ)</Label><Input value={form.video_url} onChange={e=>setForm({...form,video_url:e.target.value})} placeholder="https://..." /></div>
              <div className="sm:col-span-2"><Label>ڕیزبەندی</Label><Input type="number" value={form.order_index} onChange={e=>setForm({...form,order_index:e.target.value})} /></div>
              <label className="flex items-end gap-2 sm:col-span-2"><input type="checkbox" checked={form.is_preview} onChange={e=>setForm({...form,is_preview:e.target.checked})} /> نموونەی بێبەرامبەر</label>
              <Button className="sm:col-span-2" disabled={create.isPending}>{editingL ? "پاشەکەوت" : "زیادکردن"}</Button>
              {editingL && <Button type="button" variant="outline" className="sm:col-span-2" onClick={()=>setForm(emptyL)}>پاشگەزبوونەوە</Button>}
            </form>
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">زیادکردنی کۆمەڵێک وانە یەکجار</h3>
              <Button type="button" size="sm" variant="outline" onClick={()=>setBulkRows([...bulkRows, emptyRow()])}>
                <Plus className="ml-1 h-4 w-4" /> ڕیزی نوێ
              </Button>
            </div>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label>پێشگری ناوی خۆکار (کاتێک ناونیشان بەتاڵ بێت)</Label>
                <Input value={autoTitle} onChange={e=>setAutoTitle(e.target.value)} placeholder="وانەی" />
              </div>
              <div>
                <Label>دەستپێکی ڕیزبەندی (ئیختیاری)</Label>
                <Input type="number" value={startIndex} onChange={e=>setStartIndex(e.target.value)} placeholder={String((lessons?.length ?? 0) + 1)} />
              </div>
            </div>
            <div className="space-y-3">
              {bulkRows.map((r, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Label className="text-xs">ناونیشان</Label>
                    <Input value={r.title} onChange={e=>{ const n=[...bulkRows]; n[idx]={...r,title:e.target.value}; setBulkRows(n); }} placeholder={`${autoTitle} ${(Number(startIndex)||((lessons?.length ?? 0)+1)) + idx}`} />
                  </div>
                  <div className="sm:col-span-5">
                    <Label className="text-xs">بەستەری ڤیدیۆ</Label>
                    <Input value={r.video_url} onChange={e=>{ const n=[...bulkRows]; n[idx]={...r,video_url:e.target.value}; setBulkRows(n); }} placeholder="https://..." />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">ماوە (خولەک)</Label>
                    <Input type="number" value={r.duration_min} onChange={e=>{ const n=[...bulkRows]; n[idx]={...r,duration_min:e.target.value}; setBulkRows(n); }} />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <Button type="button" size="icon" variant="ghost" onClick={()=>setBulkRows(bulkRows.filter((_,i)=>i!==idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="sm:col-span-11">
                    <Label className="text-xs">وەسف (ئیختیاری)</Label>
                    <Textarea rows={1} value={r.description} onChange={e=>{ const n=[...bulkRows]; n[idx]={...r,description:e.target.value}; setBulkRows(n); }} />
                  </div>
                  <label className="flex items-end gap-2 text-xs sm:col-span-1">
                    <input type="checkbox" checked={r.is_preview} onChange={e=>{ const n=[...bulkRows]; n[idx]={...r,is_preview:e.target.checked}; setBulkRows(n); }} /> نموونە
                  </label>
                </div>
              ))}
            </div>
            <Button className="mt-3 w-full" disabled={bulkCreate.isPending} onClick={()=>bulkCreate.mutate()}>
              {bulkCreate.isPending ? "زیادکردن..." : "زیادکردنی هەموو وانەکان"}
            </Button>
          </CardContent></Card>

          <Card><CardContent className="p-0">
            {!lessons?.length ? (
              <p className="p-6 text-center text-muted-foreground">هێشتا وانە نییە</p>
            ) : (
              <ul className="divide-y">
                {lessons.map((l, i) => (
                  <li key={l.id} className="flex items-center justify-between p-4">
                    <div>
                      <span className="font-bold">{i+1}.</span> {l.title}
                      {l.is_preview && <span className="mx-2 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">نموونە</span>}
                      {l.duration_seconds ? <span className="text-xs text-muted-foreground">• {Math.round(l.duration_seconds/60)} خ</span> : null}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={()=>setForm({ id:l.id, title:l.title, description:l.description||"", video_url:"", order_index:String(l.order_index), is_preview:l.is_preview, duration_seconds:String(l.duration_seconds||0) })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={()=>{ if(confirm("دڵنیایت؟")) del.mutate(l.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
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

function ImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("course-images").upload(path, file, { upsert: false });
      if (error) throw error;
      // 1 year signed URL
      const { data, error: sErr } = await supabase.storage.from("course-images").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (sErr) throw sErr;
      onUploaded(data.signedUrl);
      toast.success("وێنە بارکرا");
    } catch (err: any) {
      toast.error(err.message || "هەڵە لە بارکردن");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }
  return (
    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">
      <Upload className="h-4 w-4" /> {busy ? "بارکردن..." : "بارکردنی وێنە"}
      <input type="file" accept="image/*" className="hidden" onChange={handle} disabled={busy} />
    </label>
  );
}