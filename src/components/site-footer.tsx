export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} فێرگە — هەموو مافەکان پارێزراون
      </div>
    </footer>
  );
}