import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/messages")({ component: Messages });

function Messages() {
  const qc = useQueryClient();
  const { data: messages } = useQuery({
    queryKey: ["messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("messages").update({ is_read: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });

  useEffect(() => {
    const unread = messages?.filter(m => !m.is_read).map(m => m.id);
    if (unread?.length) markRead.mutate(unread);
  }, [messages]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">نامەکان</h1>
      {!messages?.length ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          هیچ نامەیەکت نییە
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <Card key={m.id}>
              <CardContent className="p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-bold">{m.title}</h3>
                  <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                </div>
                {m.body && <p className="text-sm text-muted-foreground">{m.body}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}