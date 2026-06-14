import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, Plus, LifeBuoy, Megaphone, Users, MessageCircle } from "lucide-react";
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

function Messages() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

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
      const { data, error } = await sb.from("public_profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null }[];
    },
  });

  const { data: parts } = useQuery({
    queryKey: ["participants"],
    enabled: !!convs?.length,
    queryFn: async () => {
      const { data, error } = await sb.from("conversation_participants").select("conversation_id, user_id");
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

  function nameFor(c: Conversation): string {
    if (c.title) return c.title;
    if (c.type === "dm" && parts && profiles && user) {
      const others = parts.filter(p => p.conversation_id === c.id && p.user_id !== user.id);
      const other = others[0];
      const name = profiles.find(p => p.id === other?.user_id)?.full_name;
      return name || "نامەی تایبەت";
    }
    return c.type === "support" ? "پشتگیری" : c.type === "course_group" ? "گرووپی کۆرس" : "ڕاگەیاندن";
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">نامەکان</h1>
        <div className="flex gap-2">
          <NewDmButton />
          <SupportButton />
          {isAdmin && <AnnounceButton />}
        </div>
      </div>

      <div className="grid h-[calc(100vh-220px)] min-h-[500px] gap-4 md:grid-cols-[280px_1fr]">
        <Card className="overflow-hidden">
          <div className="h-full overflow-y-auto">
            {!convs?.length ? (
              <p className="p-6 text-center text-sm text-muted-foreground">هیچ گفتوگۆیەک نییە</p>
            ) : convs.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 border-b px-4 py-3 text-right transition hover:bg-muted ${activeId === c.id ? "bg-muted" : ""}`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  {c.type === "support" ? <LifeBuoy className="h-4 w-4" /> :
                   c.type === "announcement" ? <Megaphone className="h-4 w-4" /> :
                   c.type === "course_group" ? <Users className="h-4 w-4" /> :
                   <MessageCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{nameFor(c)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex h-full flex-col overflow-hidden">
          {activeId ? <ChatPanel conversationId={activeId} title={nameFor(convs!.find(c => c.id === activeId)!)} isAnnouncement={convs?.find(c => c.id === activeId)?.type === "announcement"} /> : (
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
      return data as { id: string; sender_id: string; body: string; created_at: string }[];
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
    mutationFn: async (body: string) => {
      const { error } = await sb.from("chat_messages").insert({ conversation_id: conversationId, sender_id: user!.id, body });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["chat", conversationId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const canSend = !isAnnouncement || isAdmin;

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
                <div className="whitespace-pre-wrap text-sm">{m.body}</div>
                <div className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {canSend ? (
        <form
          onSubmit={e => { e.preventDefault(); if (text.trim()) send.mutate(text.trim()); }}
          className="flex gap-2 border-t p-3"
        >
          <Input value={text} onChange={e => setText(e.target.value)} placeholder="نووسە..." />
          <Button type="submit" size="icon" disabled={!text.trim() || send.isPending}><Send className="h-4 w-4" /></Button>
        </form>
      ) : (
        <div className="border-t p-3 text-center text-xs text-muted-foreground">تەنها ئەدمین دەتوانێت ڕاگەیاندن بنووسێت</div>
      )}
    </>
  );
}

function NewDmButton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: profiles } = useQuery({
    queryKey: ["public_profiles_picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await sb.from("public_profiles").select("id, full_name").limit(200);
      if (error) throw error;
      return (data as { id: string; full_name: string | null }[]).filter(p => p.id !== user?.id);
    },
  });
  const filtered = useMemo(() => (profiles || []).filter(p => (p.full_name || "").toLowerCase().includes(q.toLowerCase())), [profiles, q]);

  async function start(otherId: string) {
    const { error } = await sb.rpc("start_dm", { _other: otherId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" /> گفتوگۆ</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>دەستپێکی گفتوگۆ</DialogTitle></DialogHeader>
        <Input placeholder="گەڕان بە ناو..." value={q} onChange={e => setQ(e.target.value)} />
        <div className="max-h-80 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} onClick={() => start(p.id)} className="block w-full rounded px-3 py-2 text-right hover:bg-muted">
              {p.full_name || "بەکارهێنەر"}
            </button>
          ))}
          {!filtered.length && <p className="p-4 text-center text-sm text-muted-foreground">هیچ بەکارهێنەرێک نەدۆزرایەوە</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupportButton() {
  const qc = useQueryClient();
  async function open() {
    const { error } = await sb.rpc("start_support_chat");
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    toast.success("گفتوگۆی پشتگیری کرایەوە");
  }
  return <Button variant="outline" size="sm" className="gap-2" onClick={open}><LifeBuoy className="h-4 w-4" /> پشتگیری</Button>;
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