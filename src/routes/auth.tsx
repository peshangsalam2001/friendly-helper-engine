import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).default("signin") });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"signin"|"signup">(mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/account" }); }, [user, navigate]);
  useEffect(() => { setTab(mode); }, [mode]);

  async function signin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error("داخڵبوون سەرنەکەوت — ئیمەیل یاخود وشەی نهێنی هەڵەیە"); return; }
    toast.success("بەخێر بێیتەوە!");
    navigate({ to: "/account" });
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    const schema = z.object({
      email: z.string().email("ئیمەیلێکی دروست بنووسە"),
      password: z.string().min(6, "وشەی نهێنی پێویستە ٦ پیت یاخود زیاتر بێت"),
      name: z.string().min(2, "ناوەکەت بنووسە"),
    });
    const parsed = schema.safeParse({ email, password, name });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name, phone } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("هەژمار دروستکرا! بەخێر بێیت.");
    navigate({ to: "/account" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("داخڵبوون بە گووگڵ سەرنەکەوت"); return; }
    if (result.redirected) return;
    navigate({ to: "/account" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <Tabs value={tab} onValueChange={(v)=>setTab(v as any)} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">داخڵبوون</TabsTrigger>
                <TabsTrigger value="signup">دروستکردنی هەژمار</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button type="button" variant="outline" className="mb-4 w-full" onClick={google}>
              بەردەوام بوون بە Google
            </Button>
            <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> یاخود <div className="h-px flex-1 bg-border" />
            </div>

            {tab === "signin" ? (
              <form onSubmit={signin} className="space-y-4">
                <div><Label>ئیمەیل</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <div><Label>وشەی نهێنی</Label><Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"داخڵبە"}</Button>
              </form>
            ) : (
              <form onSubmit={signup} className="space-y-4">
                <div><Label>ناوی تەواو</Label><Input required value={name} onChange={e=>setName(e.target.value)} /></div>
                <div><Label>ژمارەی مۆبایل (ئیختیاری)</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} /></div>
                <div><Label>ئیمەیل</Label><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                <div><Label>وشەی نهێنی</Label><Input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"دروستکردنی هەژمار"}</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}