import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"ok"|"err"|null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) { setResult("err"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setResult(error ? "err" : "ok");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div>
              <h1 className="text-xl font-bold">گەڕاندنەوەی وشەی نهێنی</h1>
              <p className="mt-1 text-sm text-muted-foreground">ئیمەیڵی هەژمارەکەت بنووسە</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>ئیمەیڵ</Label>
                <Input type="email" required value={email} onChange={e=>setEmail(e.target.value)} />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading ? "چاوەڕێبە..." : "وشەی نهێنیم لەبیکردووە"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Dialog open={result !== null} onOpenChange={(o)=>{ if (!o) setResult(null); }}>
          <DialogContent>
            {result === "ok" ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    ئیمەیڵەکە دروستە
                  </DialogTitle>
                  <DialogDescription>
                    وشەی نهێنی هەژمارەکەت نێردرا بۆ ئیمەیڵەکەت بە پەیامێکی تایبەت
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={()=>navigate({ to: "/auth", search: { mode: "signin" } })}>
                    داخڵی هەژمارەکەت ببە
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    ئیمەیڵەکە هەڵەیە
                  </DialogTitle>
                  <DialogDescription>
                    تکایە دڵنیابەرەوە لە دروستی ئیمەیڵەکەی نووسیوتە و پاشان هەوڵبدەرەوە
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={()=>setResult(null)}>دووبارە هەوڵبدەرەوە</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
      <SiteFooter />
    </div>
  );
}