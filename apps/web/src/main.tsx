import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastHost } from "./components/Toasts";
import { routeTree } from "./routeTree.gen";
import "./styles/tokens.css";
import "./styles/base.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
});

const router = createRouter({ routeTree, context: { queryClient } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Dev skips the worker so Vite's HMR isn't served from cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastHost>
        <RouterProvider router={router} />
      </ToastHost>
    </QueryClientProvider>
  </StrictMode>,
);
