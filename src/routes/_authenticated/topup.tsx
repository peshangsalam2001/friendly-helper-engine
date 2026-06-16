import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Copy, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/topup")({ component: Topup });

const FIB_NUMBER = "07701669021";

const ALLOWED_MIME = ["image/jpeg","image/png","image/webp","image/gif"];
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif)$/i;

function Topup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"fib"|"fastpay"|"superqi">("fib");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File|null>(null);
  const [loading, setLoading] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formattedDate = `${pad(now.getDate())}-${pad(now.getMonth()+1)}-${now.getFullYear()} / ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt < 1000) { toast.error("بڕێکی دروست بنووسە (لانیکەم ١٠٠٠ د.ع)"); return; }
    if (!accountHolder.trim()) { toast.error("تکایە ناوی هەژمارەکەت بنووسە"); return; }
    if (!senderNumber.trim()) { toast.error("تکایە ژمارەی هەژمارەکەت بنووسە"); return; }
    if (!file) { toast.error("تکایە وێنەی بەڵگەی پارەدان زیاد بکە"); return; }
    if (!ALLOWED_MIME.includes(file.type) || !ALLOWED_EXT.test(file.name)) {
      toast.error("تەنیا وێنە (JPG, PNG, WEBP, GIF) ڕێگەپێدراوە"); return;
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("قەبارەی وێنە دەبێت کەمتر بێت لە ٥ مێگابایت"); return; }
    setLoading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = `${user!.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("topup_requests").insert({
        user_id: user!.id, amount: amt, method, proof_url: path, note,
        account_holder_name: accountHolder.trim(),
        sender_number: senderNumber.trim(),
      });
      if (insErr) throw insErr;
      toast.success("داواکاریەکەت بە سەرکەوتوویی تۆمارکرا. تکایە چاوەڕوانبە تاکو لەماوەی کەمتر لە ٢٤ کاتژمێر باڵانسەکە دەخرێتە سەر هەژمارەکەت");
      navigate({ to: "/account" });
    } catch (err: any) {
      toast.error(err.message || "هەڵەیەک ڕوویدا");
    } finally { setLoading(false); }
  }

  function copyNumber() {
    navigator.clipboard.writeText(FIB_NUMBER);
    toast.success("ژمارەکە کۆپی کرا");
  }

  // QR for FIB number
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(FIB_NUMBER)}`;

  return (
    <div className="container mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h1 className="text-2xl font-bold">زیادکردنی باڵانس</h1>
            <p className="text-sm text-muted-foreground">فۆڕمەکە پڕ بکەرەوە و وێنەی بەڵگەی پارەدان زیاد بکە</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>بڕی باڵانس (د.ع)</Label>
              <Input type="number" min={1000} step={1000} required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="25000" />
            </div>
            <div>
              <Label>ناوی هەژمارەکەت (FIB / Fastpay / SuperQi)</Label>
              <Input required value={accountHolder} onChange={e=>setAccountHolder(e.target.value)} placeholder="ناوی تەواوی هەژمار" />
            </div>
            <div>
              <Label>ژمارەی ئێف ئای بی یاخود فاستپەی یان سوپەرکی</Label>
              <Input required value={senderNumber} onChange={e=>setSenderNumber(e.target.value)} placeholder="07XXXXXXXXX" inputMode="tel" />
            </div>
            <div>
              <Label>بەرواری ناردن</Label>
              <Input value={formattedDate} readOnly disabled />
            </div>
            <div>
              <Label className="mb-2 block">ڕێگای پارەدان</Label>
              <RadioGroup value={method} onValueChange={(v)=>setMethod(v as any)} className="grid grid-cols-3 gap-2">
                {(["fib","fastpay","superqi"] as const).map(m => (
                  <label key={m} className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border p-3 text-sm ${method===m?"border-primary bg-primary/5":""}`}>
                    <RadioGroupItem value={m} className="sr-only" />
                    {m === "fib" ? "FIB" : m === "fastpay" ? "FastPay" : "SuperQi"}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label>وێنەی بەڵگەی پارەدان</Label>
              <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:border-primary">
                <Upload className="h-4 w-4" />
                {file ? file.name : "هەڵبژاردنی وێنە..."}
                <input type="file" accept="image/*" className="sr-only" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div>
              <Label>تێبینی (ئیختیاری)</Label>
              <Textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" disabled={loading}>{loading?"چاوەڕێبە...":"ناردنی داواکاری"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6 text-center">
          <h3 className="font-bold">پارەکە بنێرە بۆ ئەم ژمارەیە</h3>
          <div className="rounded-lg bg-muted p-4 text-lg font-bold tracking-wider">{FIB_NUMBER}</div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={copyNumber}>
            <Copy className="h-4 w-4" /> کۆپیکردنی ژمارە
          </Button>
          <div className="rounded-lg border p-3">
            <img src={qrUrl} alt="QR Code" className="mx-auto" />
            <p className="mt-2 text-xs text-muted-foreground">سکانی QR بکە بۆ ناردنی پارە</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}