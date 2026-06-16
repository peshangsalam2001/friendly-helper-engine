import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/onboarding/username")({ component: OnboardingUsername });

const sb = supabase as any;

function OnboardingUsername() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  if (profile?.username) {
    navigate({ to: "/account" });
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (!/^[A-Za-z0-9_]{3,30}$/.test(u)) {
      toast.error("Username پێویستە لەنێوان ٣-٣٠ (ژمارە یاخود پیت) بێت");
      return;
    }
    setLoading(true);
    try {
      const { data: available } = await sb.rpc("username_available", { _username: u });
      if (!available) { toast.error("ئەم یوزەرنەیمە بەکارهاتووە"); return; }
      const { error } = await supabase.from("profiles").update({ username: u }).eq("id", user!.id);
      if (error) { toast.error(error.message); return; }
      await qc.invalidateQueries({ queryKey: ["profile", user!.id] });
      toast.success("یوزەرنەیم پاشەکەوتکرا");
      navigate({ to: "/account" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-10">
      <Card className="w-full p-6">
        <h1 className="mb-2 text-2xl font-bold">یوزەرنەیمێک هەڵبژێرە</h1>
        <p className="mb-4 text-sm text-muted-foreground">بۆ تەواوکردنی هەژمارەکەت یوزەرنەیمێک دیاری بکە.</p>
        <form onSubmit={submit} className="space-y-3">
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="یوزەرنەیم" autoFocus />
          <Button type="submit" disabled={loading} className="w-full">{loading ? "..." : "تەواوکردن"}</Button>
        </form>
      </Card>
    </div>
  );
}