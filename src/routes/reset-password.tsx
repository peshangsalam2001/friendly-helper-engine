import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("وشەی نهێنی پێویستە ٦ پیت یاخود زیاتر بێت");
    if (pw !== pw2) return toast.error("دوو وشە نهێنیەکە وەک یەک نین");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("وشەی نهێنی نوێ کرایەوە");
    navigate({ to: "/auth", search: { mode: "signin" } });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-xl font-bold">دانانی وشەی نهێنی نوێ</h1>
            <form onSubmit={submit} className="space-y-4">
              <div><Label>وشەی نهێنی نوێ</Label><Input type="password" required value={pw} onChange={e=>setPw(e.target.value)} /></div>
              <div><Label>دووبارە بنووسە</Label><Input type="password" required value={pw2} onChange={e=>setPw2(e.target.value)} /></div>
              <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"نوێکردنەوە"}</Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}