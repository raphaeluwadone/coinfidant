import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Mascot } from "./Mascot";

export function ComingSoon({ title, line }: { title: string; line: string }) {
  return (
    <div
      style={{
        maxWidth: 420,
        margin: "48px auto",
        display: "grid",
        justifyItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <Mascot size={64} mood="happy" />
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{title}</h1>
      <p style={{ margin: 0, color: "var(--text-soft)", fontWeight: 500 }}>{line}</p>
      <Button asChild variant="link" size="inline">
        <Link to="/">Back to Today</Link>
      </Button>
    </div>
  );
}
