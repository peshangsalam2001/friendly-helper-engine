import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, useProfile, useIsAdmin } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Menu, Wallet } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationsBell } from "@/components/notifications-bell";

function NavLinks({ onClick }: { onClick?: () => void }) {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const base =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-primary";
  return (
    <>
      <Link to="/" className={base} onClick={onClick} activeProps={{ className: "text-primary" }}>سەرەکی</Link>
      <Link to="/courses" className={base} onClick={onClick} activeProps={{ className: "text-primary" }}>کۆرسەکان</Link>
      <Link to="/guide" className={base} onClick={onClick} activeProps={{ className: "text-primary" }}>فێرکاری</Link>
      {user && <Link to="/messages" className={base} onClick={onClick} activeProps={{ className: "text-primary" }}>نامە</Link>}
      {user && <Link to="/account" className={base} onClick={onClick} activeProps={{ className: "text-primary" }}>هەژمارەکەم</Link>}
      {isAdmin && <Link to="/admin" className={base} onClick={onClick} activeProps={{ className: "text-primary" }}>ئەدمین</Link>}
    </>
  );
}

export function SiteHeader() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  useRouterState();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">ئەکادیمیای پێشەنگ</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLinks />
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <NotificationsBell />
              <Link to="/topup">
                <Button variant="secondary" size="sm" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  {Number(profile?.balance ?? 0).toLocaleString()} د.ع
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="چوونە دەرەوە">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }}>
                <Button variant="ghost" size="sm">داخڵبوون</Button>
              </Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="sm">دروستکردنی هەژمار</Button>
              </Link>
            </>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="مێنیو">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex flex-col gap-2">
            <div className="mt-8 flex flex-col gap-1">
              <NavLinks onClick={() => setOpen(false)} />
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t pt-4">
              {user ? (
                <>
                  <Link to="/topup" onClick={() => setOpen(false)}>
                    <Button variant="secondary" className="w-full gap-2">
                      <Wallet className="h-4 w-4" />
                      باڵانس: {Number(profile?.balance ?? 0).toLocaleString()} د.ع
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => { setOpen(false); signOut(); }}>
                    چوونە دەرەوە
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth" search={{ mode: "signin" }} onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full">داخڵبوون</Button>
                  </Link>
                  <Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)}>
                    <Button className="w-full">دروستکردنی هەژمار</Button>
                  </Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}