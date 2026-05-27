import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Suppress noisy browser-extension errors that are unrelated to the app
// (e.g. "Could not establish connection. Receiving end does not exist.")
if (typeof window !== "undefined") {
  const SUPPRESSED = [
    "Could not establish connection",
    "Receiving end does not exist",
    "Extension context invalidated",
    "Cannot read properties of undefined (reading 'disconnect')",
  ];

  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message ?? String(e?.reason ?? "");
    if (SUPPRESSED.some((s) => msg.includes(s))) {
      e.preventDefault();
    }
  });

  window.addEventListener("error", (e) => {
    const msg = e?.message ?? "";
    if (SUPPRESSED.some((s) => msg.includes(s))) {
      e.preventDefault();
    }
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
