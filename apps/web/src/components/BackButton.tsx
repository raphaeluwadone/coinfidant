import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Fallback = "/" | "/history" | "/settings";

/** Goes to the previous in-app page, or to `fallback` when the page was opened directly. */
export function BackButton({ fallback = "/", corner = false }: { fallback?: Fallback; corner?: boolean }) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return (
    <Button
      size="icon"
      aria-label="Back"
      className={cn(
        "self-start justify-self-start font-extrabold",
        corner && "absolute top-[calc(16px+env(safe-area-inset-top,0px))] left-4 z-[2]",
      )}
      onClick={() => (canGoBack ? router.history.back() : navigate({ to: fallback }))}
    >
      ←
    </Button>
  );
}
