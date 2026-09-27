import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";

type Fallback = "/" | "/history" | "/settings";

/** Goes to the previous in-app page, or to `fallback` when the page was opened directly. */
export function BackButton({ fallback = "/", corner = false }: { fallback?: Fallback; corner?: boolean }) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return (
    <button
      type="button"
      className={`back-btn ${corner ? "back-btn--corner" : ""}`}
      aria-label="Back"
      onClick={() => (canGoBack ? router.history.back() : navigate({ to: fallback }))}
    >
      ←
    </button>
  );
}
