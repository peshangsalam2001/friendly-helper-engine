import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, Search, Megaphone, Users, MessageCircle, Paperclip, X, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({ component: Messages });

type Conversation = {
  id: string;
  type: "dm" | "support" | "course_group" | "announcement";
  title: string | null;
  course_id: string | null;
  updated_at: string;
};

const sb = supabase as any;

type Attachment = { url: string; path: string; name: string; type: string; size: number };

function Messages() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");

  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await sb.from("conversations").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
  });

  // names for DM partners
  const { data: profiles } = useQuery({
    queryKey: ["public_profiles"],
    queryFn: async () => {
      const { data, error } = await sb.from("public_profiles").select("id, full_name, username");
      if (error) throw error;
      return data as { id: string; full_name: string | null; username: string | null }[];
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["participants"],
    enabled: !!convs?.length,
    queryFn: async () => {
      const { data, error } = await sb.from("conversation_participants").select("conversation_id, user_id").order("user_id", { ascending: true });
      if (error) throw error;
      return data as { conversation_id: string; user_id: string }[];
    },
  });

  useEffect(() => {
    if (!activeId && convs?.length) setActiveId(convs[0].id);
  }, [convs, activeId]);

  // realtime new conversations
  useEffect(() => {
    const ch = supabase.channel("conv-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  function nameFor(c: Conversation, prefer: "full_name" | "username" = "username"): string {
    if (c.type === "dm" && parts && profiles && user) {
      const others = parts.filter(p => p.conversation_id === c.id && p.user_id !== user.id);
      const other = others[0];
      const p = profiles.find(p => p.id === other?.user_id);
      if (prefer === "username") return p?.username || p?.full_name || "نامەی تایبەت";
      return p?.full_name || p?.username || "نامەی تایبەت";
    }
    if (c.title) return c.title;
    return c.type === "support" ? "پشتگیری" : c.type === "course_group" ? "گرووپی کۆرس" : "ڕاگەیاندن";
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">نامەکان</h1>
        <div className="flex gap-2">
          <UserSearchButton />
          {isAdmin && <AnnounceButton />}
        </div>
      </div>

      <div className="grid h-[calc(100vh-220px)] min-h-[500px] gap-4 md:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="border-b p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="گەڕان لە لیست..." className="pr-8" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
            {(() => {
              const q = listQuery.trim().toLowerCase();
              const list = (convs || []).filter(c => !q || nameFor(c).toLowerCase().includes(q) || nameFor(c, "full_name").toLowerCase().includes(q));
              if (!list.length) return <p className="p-6 text-center text-sm text-muted-foreground">هیچ گفتوگۆیەک نییە</p>;
              return list.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-right transition hover:bg-muted ${activeId === c.id ? "bg-muted" : ""}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  {c.type === "announcement" ? <Megaphone className="h-4 w-4" /> :
                   c.type === "course_group" ? <Users className="h-4 w-4" /> :
                   <MessageCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{nameFor(c)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</div>
                </div>
              </button>
              ));
            })()}
            </div>
          </div>
        </Card>

        <Card className="flex h-full flex-col overflow-hidden">
          {activeId ? <ChatPanel conversationId={activeId} title={nameFor(convs!.find(c => c.id === activeId)!, "full_name")} isAnnouncement={convs?.find(c => c.id === activeId)?.type === "announcement"} /> : (
            <div className="grid flex-1 place-items-center text-muted-foreground">گفتوگۆیەک هەڵبژێرە</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChatPanel({ conversationId, title, isAnnouncement }: { conversationId: string; title: string; isAnnouncement?: boolean }) {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["chat", conversationId],
    queryFn: async () => {
      const { data, error } = await sb.from("chat_messages")
        .select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as { id: string; sender_id: string; body: string | null; created_at: string; attachments: Attachment[] }[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["public_profiles"],
    queryFn: async () => {
      const { data } = await sb.from("public_profiles").select("id, full_name");
      return (data || []) as { id: string; full_name: string | null }[];
    },
  });

  useEffect(() => {
    sb.rpc("mark_conversation_read", { _conv: conversationId });
    const ch = supabase.channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["chat", conversationId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = useMutation({
    mutationFn: async ({ body, attachments }: { body: string; attachments: Attachment[] }) => {
      const { error } = await sb.from("chat_messages").insert({ conversation_id: conversationId, sender_id: user!.id, body: body || null, attachments });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); setPending([]); qc.invalidateQueries({ queryKey: ["chat", conversationId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const canSend = !isAnnouncement || isAdmin;
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name}: زۆر گەورەیە (50MB)`); continue; }
        const path = `${conversationId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, f, { contentType: f.type });
        if (error) { toast.error(error.message); continue; }
        const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
        uploaded.push({ url: signed?.signedUrl || "", path, name: f.name, type: f.type, size: f.size });
      }
      setPending(p => [...p, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className="border-b p-4">
        <div className="font-semibold">{title}</div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages?.map(m => {
          const mine = m.sender_id === user?.id;
          const senderName = profiles?.find(p => p.id === m.sender_id)?.full_name || "بەکارهێنەر";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="mb-1 text-xs font-semibold opacity-70">{senderName}</div>}
                {m.body && <div className="whitespace-pre-wrap text-sm">{m.body}</div>}
                {m.attachments?.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.attachments.map((a, i) => <AttachmentView key={i} a={a} />)}
                  </div>
                )}
                <div className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {canSend ? (
        <form
          onSubmit={e => { e.preventDefault(); if (text.trim() || pending.length) send.mutate({ body: text.trim(), attachments: pending }); }}
          className="border-t p-3"
        >
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" /> <span className="max-w-32 truncate">{a.name}</span>
                  <button type="button" onClick={() => setPending(p => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input ref={fileRef} type="file" hidden multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={e => handleFiles(e.target.files)} />
            <Button type="button" size="icon" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}><Paperclip className="h-4 w-4" /></Button>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="نووسە..." />
            <Button type="submit" size="icon" disabled={(!text.trim() && !pending.length) || send.isPending || uploading}><Send className="h-4 w-4" /></Button>
          </div>
        </form>
      ) : (
        <div className="border-t p-3 text-center text-xs text-muted-foreground">تەنها ئەدمین دەتوانێت ڕاگەیاندن بنووسێت</div>
      )}
    </>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  const isImg = a.type?.startsWith("image/");
  const isVid = a.type?.startsWith("video/");
  const isAud = a.type?.startsWith("audio/");
  if (isImg) return <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} className="max-h-64 rounded" /></a>;
  if (isVid) return <video src={a.url} controls className="max-h-64 rounded" />;
  if (isAud) return <audio src={a.url} controls />;
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded bg-background/20 px-2 py-1 text-xs underline">
      <Paperclip className="h-3 w-3" /> {a.name}
    </a>
  );
}

function UserSearchButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: results, isFetching } = useQuery({
    queryKey: ["user_search", q],
    enabled: open && q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await sb.rpc("search_users", { _q: q.trim() });
      if (error) throw error;
      return data as { id: string; username: string | null; full_name: string | null; phone: string | null; is_admin: boolean }[];
    },
  });

  async function start(otherId: string) {
    const { data, error } = await sb.rpc("start_dm", { _other: otherId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setOpen(false); setQ("");
    toast.success("گفتوگۆ کرایەوە");
    return data;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Search className="h-4 w-4" /> گەڕان بۆ بەکارهێنەر</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>گەڕان بە یوزەرنەیم یان ژمارەی مۆبایل</DialogTitle></DialogHeader>
        <Input placeholder="یوزەرنەیم یان ژمارە..." value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <div className="max-h-96 overflow-y-auto">
          {q.trim().length < 2 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">لانیکەم ٢ پیت بنووسە</p>
          ) : isFetching ? (
            <p className="p-4 text-center text-sm text-muted-foreground">گەڕان...</p>
          ) : !results?.length ? (
            <p className="p-4 text-center text-sm text-muted-foreground">هیچ بەکارهێنەرێک نەدۆزرایەوە</p>
          ) : results.map(u => (
            <button key={u.id} onClick={() => start(u.id)} className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-right hover:bg-muted">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {u.username || u.full_name || "بەکارهێنەر"}
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${u.is_admin ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground"}`}>
                    {u.is_admin ? <><ShieldCheck className="h-3 w-3" /> ئەدمین</> : <><UserIcon className="h-3 w-3" /> بەکارهێنەری ئاسایی</>}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{u.full_name}{u.phone ? ` • ${u.phone}` : ""}</div>
              </div>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnnounceButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  async function submit() {
    if (!title.trim()) return;
    const { error } = await sb.rpc("post_announcement", { _title: title, _body: body });
    if (error) return toast.error(error.message);
    toast.success("ڕاگەیاندن نێردرا");
    setOpen(false); setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Megaphone className="h-4 w-4" /> ڕاگەیاندن</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>ڕاگەیاندنی نوێ</DialogTitle></DialogHeader>
        <Input placeholder="سەردێر" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea
          className="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
          placeholder="ناوەرۆک"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <Button onClick={submit}>ناردن بۆ هەموو بەکارهێنەران</Button>
      </DialogContent>
    </Dialog>
  );
}