import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "فێرکاری — فێرگە" },
      { name: "description", content: "چۆن وێبسایتەکە بەکاربێنیت، باڵانس زیاد بکەیت و کۆرس بکڕیت." },
    ],
  }),
  component: Guide,
});

const steps = [
  { n: 1, t: "دروستکردنی هەژمار", d: "لە سەرەوەی پەڕە کلیک لە «دروستکردنی هەژمار» بکە و فۆڕمەکە پڕ بکەرەوە." },
  { n: 2, t: "زیادکردنی باڵانس", d: "بڕۆ بۆ پەڕەی «زیادکردنی باڵانس» و ڕێگەی پارەدان هەڵبژێرە (ئێف ئایبی، فاستپەی یاخود سوپەرکی). پارەکە بنێرە و فۆڕمەکە تەواوبکە." },
  { n: 3, t: "چاوەڕێی پەسەندکردن", d: "تیمەکەمان لە ماوەی کەمتر لە ٢٤ کاتژمێر داواکارییەکەت پشکنین دەکات و باڵانسەکە دەخاتە سەر هەژمارەکەت." },
  { n: 4, t: "کڕینی کۆرس", d: "بڕۆ بۆ پەڕەی کۆرسەکان، ئەو کۆرسەی دەتەوێت هەڵیبژێرە و «کڕینی کۆرس» کلیک بکە. نرخی کۆرس لە باڵانسەکەت کەم دەکرێتەوە." },
  { n: 5, t: "بینینی وانەکان", d: "دوای کڕین، دەتوانیت هەموو وانە ڤیدیۆکانی کۆرسەکە ببینیت لە هەر کاتێک." },
];

function Guide() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-3xl font-bold">چۆن کاردەکات؟</h1>
        <p className="mb-8 text-muted-foreground">ڕێنمایی بەکارهێنانی پلاتفۆڕم</p>
        <div className="space-y-4">
          {steps.map((s) => (
            <Card key={s.n}>
              <CardContent className="flex gap-4 p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground">
                  {s.n}
                </div>
                <div>
                  <h3 className="font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}