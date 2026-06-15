import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Mail, MessageSquare } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  // Sign-in fields
  const [siIdentifier, setSiIdentifier] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign-up fields
  const [suName, setSuName] = useState("");
  const [suUsername, setSuUsername] = useState("");
  const [suAge, setSuAge] = useState("");
  const [suLocation, setSuLocation] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suPassword2, setSuPassword2] = useState("");
  const [suReferral, setSuReferral] = useState("");

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<"email"|null>(null);

  useEffect(() => { if (user) navigate({ to: "/account" }); }, [user, navigate]);
  useEffect(() => { setTab(mode); }, [mode]);

  async function signin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let email = siIdentifier.trim();
    if (!email.includes("@")) {
      // treat as username — resolve to email
      const { data, error } = await (supabase.rpc as any)("email_for_username", { _username: email });
      if (error || !data) {
        setLoading(false);
        toast.error("داخڵبوون سەرنەکەوت — ئیمەیل/ناوی بەکارهێنەر یاخود وشەی نهێنی هەڵەیە");
        return;
      }
      email = data as string;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: siPassword });
    setLoading(false);
    if (error) { toast.error("داخڵبوون سەرنەکەوت — ئیمەیل/ناوی بەکارهێنەر یاخود وشەی نهێنی هەڵەیە"); return; }
    toast.success("بەخێر بێیتەوە!");
    navigate({ to: "/account" });
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    const schema = z.object({
      name: z.string().min(2, "ناوەکەت بنووسە"),
      username: z.string().min(3, "ناوی بەکارهێنەر پێویستە ٣ پیت یاخود زیاتر بێت").regex(/^[a-zA-Z0-9_.-]+$/, "تەنها پیتی ئینگلیزی، ژمارە، _ . - ڕێگەپێدراون"),
      age: z.string().regex(/^\d+$/, "تەمەن دەبێت ژمارە بێت").refine(v => +v >= 5 && +v <= 120, "تەمەنێکی دروست بنووسە"),
      location: z.string().min(2, "شوێنی نیشتەجێبوونت بنووسە"),
      phone: z.string().min(7, "ژمارەی مۆبایلێکی دروست بنووسە"),
      email: z.string().email("ئیمەیلێکی دروست بنووسە"),
      password: z.string().min(6, "وشەی نهێنی پێویستە ٦ پیت یاخود زیاتر بێت"),
      password2: z.string(),
      referral: z.string().min(1, "تکایە هەڵبژێرە چۆن ئێمەت دۆزیەوە"),
    }).refine(d => d.password === d.password2, { message: "دوو وشە نهێنیەکە وەک یەک نین", path: ["password2"] });
    const parsed = schema.safeParse({
      name: suName, username: suUsername, age: suAge, location: suLocation,
      phone: suPhone, email: suEmail, password: suPassword, password2: suPassword2,
      referral: suReferral,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    setLoading(true);
    // Uniqueness checks
    const [{ data: usernameOk }, { data: phoneOk }] = await Promise.all([
      (supabase.rpc as any)("username_available", { _username: suUsername }),
      (supabase.rpc as any)("phone_available", { _phone: suPhone }),
    ]);
    if (!usernameOk) { setLoading(false); toast.error("ناوی بەکارهێنەر دووبارەیە. تکایە ناوێکی تر دابنێ"); return; }
    if (!phoneOk) { setLoading(false); toast.error("ئەم ژمارە مۆبایلە بۆ هەژمارێکی تر بەکارهاتووە. تکایە بیگۆڕە"); return; }

    const { error } = await supabase.auth.signUp({
      email: suEmail, password: suPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: suName, phone: suPhone, username: suUsername,
          age: suAge, location: suLocation, referral_source: suReferral,
        },
      },
    });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("registered") || m.includes("exists")) toast.error("ئەم ئیمەیڵە پێشتر هەژماری پێ دروستکراوە");
      else toast.error(error.message);
      return;
    }
    setVerifyOpen(true);
  }

  async function startPhoneVerify() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: suPhone });
    setLoading(false);
    if (error) {
      toast.error("ناردنی کۆد سەرنەکەوت — دڵنیابە کە خزمەتگوزاری SMS چالاککراوە");
      return;
    }
    setVerifyOpen(false);
    navigate({ to: "/verify-otp", search: { phone: suPhone } });
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
                <div><Label>ئیمەیڵ یاخود ناوی بەکارهێنەر</Label>
                  <Input required value={siIdentifier} onChange={e=>setSiIdentifier(e.target.value)} /></div>
                <div><Label>وشەی نهێنی</Label>
                  <Input type="password" required value={siPassword} onChange={e=>setSiPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"داخڵبە"}</Button>
                <div className="text-center">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                    وشەی نهێنیت لەبیرکردووە؟
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={signup} className="space-y-4">
                <div><Label>ناوی تەواو</Label><Input required value={suName} onChange={e=>setSuName(e.target.value)} /></div>
                <div><Label>ناوی بەکارهێنەر (Username)</Label><Input required value={suUsername} onChange={e=>setSuUsername(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>تەمەن</Label><Input type="number" required value={suAge} onChange={e=>setSuAge(e.target.value)} /></div>
                  <div><Label>شوێنی نیشتەجێبوون</Label><Input required value={suLocation} onChange={e=>setSuLocation(e.target.value)} /></div>
                </div>
                <div><Label>ژمارەی مۆبایل</Label><Input required value={suPhone} onChange={e=>setSuPhone(e.target.value)} placeholder="07XXXXXXXXX" /></div>
                <div><Label>ئیمەیل</Label><Input type="email" required value={suEmail} onChange={e=>setSuEmail(e.target.value)} /></div>
                <div><Label>وشەی نهێنی</Label><Input type="password" required value={suPassword} onChange={e=>setSuPassword(e.target.value)} /></div>
                <div><Label>وشەی نهێنی (دووبارە)</Label><Input type="password" required value={suPassword2} onChange={e=>setSuPassword2(e.target.value)} /></div>
                <div>
                  <Label>چۆن ئێمەت دۆزیەوە؟</Label>
                  <Select value={suReferral} onValueChange={setSuReferral}>
                    <SelectTrigger><SelectValue placeholder="هەڵبژێرە" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Google Search">Google Search</SelectItem>
                      <SelectItem value="Youtube">Youtube</SelectItem>
                      <SelectItem value="Telegram">Telegram</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"دروستکردنی هەژمار"}</Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>هەڵبژاردنی شێوازی پشتڕاستکردنەوە</DialogTitle>
              <DialogDescription>
                دوو ڕێگات بۆ پشتڕاستکردنەوەی هەژمارەکەت هەیە. یەکێکیان هەڵبژێرە.
              </DialogDescription>
            </DialogHeader>
            {verifyMsg === "email" ? (
              <div className="rounded-md border bg-secondary/40 p-4 text-sm">
                ئێمە پەیامێکی پشتڕاستکردنەوەمان ناردووە بۆ <b>{suEmail}</b>. تکایە سندوقی نامەکانت بپشکنە و کلیکی سەر بەستەرەکە بکە.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" className="h-auto flex-col gap-2 p-4" onClick={()=>setVerifyMsg("email")}>
                  <Mail className="h-6 w-6 text-primary" />
                  <div className="font-semibold">پشتڕاستکردنەوە بە ئیمەیڵ</div>
                  <div className="text-xs text-muted-foreground">بەستەرێک بۆ ئیمەیڵەکەت دەنێردرێت</div>
                </Button>
                <Button type="button" variant="outline" className="h-auto flex-col gap-2 p-4" onClick={startPhoneVerify} disabled={loading}>
                  <MessageSquare className="h-6 w-6 text-primary" />
                  <div className="font-semibold">کۆدی ٦ ژمارەیی بە SMS</div>
                  <div className="text-xs text-muted-foreground">کۆد بۆ ژمارەی مۆبایلەکەت دەنێردرێت</div>
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={()=>{ setVerifyOpen(false); setVerifyMsg(null); navigate({ to: "/" }); }}>دواتر</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}