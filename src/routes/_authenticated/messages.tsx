import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { Send, Search, Users, MessageCircle, Paperclip, X, ShieldCheck, ArrowRight, Headphones } from "lucide-react";
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
  const [query, setQuery] = useState("");

  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await sb.from("conversations").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as Conversation[]).filter(c => c.type !== "announcement");
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
      const a = prefer === "username" ? p?.username : p?.full_name;
      const b = prefer === "username" ? p?.full_name : p?.username;
      return a || b || "بەکارهێنەر";
    }
    if (c.title) return c.title;
    return c.type === "support" ? "پشتگیری" : c.type === "course_group" ? "گرووپی کۆرس" : "گفتوگۆ";
  }

  // Inline user search
  const trimmed = query.trim();
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["user_search", trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async () => {
      const { data, error } = await sb.rpc("search_users", { _q: trimmed });
      if (error) throw error;
      return data as { id: string; username: string | null; full_name: string | null; phone: string | null; is_admin: boolean }[];
    },
  });

  async function startDm(otherId: string) {
    const { data, error } = await sb.rpc("start_dm", { _other: otherId });
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    setQuery("");
    if (data) setActiveId(data as string);
    toast.success("گفتوگۆ کرایەوە");
  }

  async function startSupport() {
    const { data, error } = await sb.rpc("start_support_chat");
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["conversations"] });
    if (data) setActiveId(data as string);
  }

  const filteredConvs = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return convs || [];
    return (convs || []).filter(c =>
      nameFor(c).toLowerCase().includes(q) || nameFor(c, "full_name").toLowerCase().includes(q),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs, parts, profiles, trimmed]);

  const activeConv = convs?.find(c => c.id === activeId);
  const showSearchResults = trimmed.length >= 2;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">نامەکان</h1>
          <p className="text-xs text-muted-foreground">گفتوگۆ لەگەڵ بەکارهێنەران و ئەدمین</p>
        </div>
        {!isAdmin && (
          <Button size="sm" variant="outline" className="gap-2" onClick={startSupport}>
            <Headphones className="h-4 w-4" /> پشتگیری
          </Button>
        )}
      </div>

      <div className="grid h-[calc(100vh-220px)] min-h-[520px] gap-4 md:grid-cols-[320px_1fr]">
        <Card className="flex flex-col overflow-hidden border-border/60">
          <div className="border-b bg-gradient-to-b from-muted/40 to-transparent p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="گەڕان بۆ بەکارهێنەر یان گفتوگۆ..."
                className="rounded-full bg-background pr-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {showSearchResults && (
              <div className="border-b">
                <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  ئەنجامی گەڕان
                </div>
                {searching ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">گەڕان...</p>
                ) : !searchResults?.length ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">هیچ بەکارهێنەرێک نەدۆزرایەوە</p>
                ) : (
                  searchResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => startDm(u.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-right transition hover:bg-muted/70"
                    >
                      <Avatar name={u.username || u.full_name || "?"} admin={u.is_admin} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate text-sm font-semibold">
                          {u.username || u.full_name || "بەکارهێنەر"}
                          {u.is_admin && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                              <ShieldCheck className="h-3 w-3" /> ئەدمین
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.full_name || ""}{u.phone ? ` • ${u.phone}` : ""}
                        </div>
                      </div>
                      <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            )}

            <div>
              {showSearchResults && (
                <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  گفتوگۆکانم
                </div>
              )}
              {!filteredConvs.length ? (
                <p className="p-6 text-center text-sm text-muted-foreground">هیچ گفتوگۆیەک نییە</p>
              ) : (
                filteredConvs.map(c => {
                  const name = nameFor(c);
                  const active = activeId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-right transition ${
                        active ? "bg-primary/10" : "hover:bg-muted/60"
                      }`}
                    >
                      {c.type === "course_group" ? (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                          <Users className="h-4 w-4" />
                        </div>
                      ) : c.type === "support" ? (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                          <Headphones className="h-4 w-4" />
                        </div>
                      ) : (
                        <Avatar name={name} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {new Date(c.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      {active && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        <Card className="flex h-full flex-col overflow-hidden border-border/60">
          {activeConv ? (
            <ChatPanel
              conversationId={activeConv.id}
              title={nameFor(activeConv, "full_name")}
              subtitle={
                activeConv.type === "dm" ? "ئۆنلاین" :
                activeConv.type === "support" ? "تیمی پشتگیری" :
                activeConv.type === "course_group" ? "گرووپی کۆرس" : ""
              }
            />
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center text-muted-foreground">
              <div>
                <MessageCircle className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <div className="text-sm">گفتوگۆیەک هەڵبژێرە یان بەکارهێنەرێک بدۆزەرەوە</div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Avatar({ name, admin }: { name: string; admin?: boolean }) {
  const ch = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground ${admin ? "bg-gradient-to-br from-primary to-primary/70" : "bg-gradient-to-br from-primary/80 to-primary/50"}`}>
      {ch}
      {admin && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-background ring-1 ring-border">
          <ShieldCheck className="h-2.5 w-2.5 text-primary" />
        </span>
      )}
    </div>
  );
}

function ChatPanel({ conversationId, title, subtitle }: { conversationId: string; title: string; subtitle?: string }) {
  const { user } = useAuth();
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
      <div className="flex items-center gap-3 border-b bg-background/80 p-3 backdrop-blur">
        <div className="relative">
          <Avatar name={title} />
          <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">{title}</div>
          {subtitle && <div className="text-[11px] text-emerald-600">{subtitle}</div>}
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto bg-[radial-gradient(circle_at_top,hsl(var(--muted)/0.4),transparent_60%)] p-4">
        {messages?.map((m, idx) => {
          const mine = m.sender_id === user?.id;
          const prev = messages[idx - 1];
          const sameSender = prev && prev.sender_id === m.sender_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60 * 1000;
          const senderName = profiles?.find(p => p.id === m.sender_id)?.full_name || "بەکارهێنەر";
          const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${sameSender ? "mt-0.5" : "mt-3"}`}>
              <div className={`group flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && !sameSender && (
                  <div className="mb-0.5 px-3 text-[11px] font-medium text-muted-foreground">{senderName}</div>
                )}
                <div
                  className={`px-3.5 py-2 text-sm shadow-sm ${
                    mine
                      ? `bg-primary text-primary-foreground ${sameSender ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-sm"}`
                      : `border bg-background ${sameSender ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-sm"}`
                  }`}
                >
                  {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                  {m.attachments?.length > 0 && (
                    <div className={`${m.body ? "mt-2" : ""} space-y-2`}>
                      {m.attachments.map((a, i) => <AttachmentView key={i} a={a} />)}
                    </div>
                  )}
                </div>
                <div className="mt-0.5 px-2 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100">{time}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={e => { e.preventDefault(); if (text.trim() || pending.length) send.mutate({ body: text.trim(), attachments: pending }); }}
        className="border-t bg-background p-3"
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
            <Button type="button" size="icon" variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()} disabled={uploading}><Paperclip className="h-4 w-4" /></Button>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder="پەیامێک بنووسە..." className="rounded-full" />
            <Button type="submit" size="icon" className="rounded-full" disabled={(!text.trim() && !pending.length) || send.isPending || uploading}><Send className="h-4 w-4" /></Button>
          </div>
      </form>
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

