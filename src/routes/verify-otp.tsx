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
import { toast } from "sonner";

const search = z.object({ phone: z.string() });

export const Route = createFileRoute("/verify-otp")({
  validateSearch: search,
  component: VerifyOtpPage,
});

function VerifyOtpPage() {
  const { phone } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setLoading(false);
    if (error) return toast.error("کۆدەکە هەڵەیە یاخود بەسەرچووە");
    toast.success("ژمارەی مۆبایل پشتڕاستکرایەوە");
    navigate({ to: "/account" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-xl font-bold">پشتڕاستکردنەوەی ژمارەی مۆبایل</h1>
            <p className="text-sm text-muted-foreground">کۆدی ٦ ژمارەیی نێردراو بۆ {phone} بنووسە</p>
            <form onSubmit={submit} className="space-y-4">
              <div><Label>کۆد</Label><Input inputMode="numeric" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} /></div>
              <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"پشتڕاستکردنەوە"}</Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}