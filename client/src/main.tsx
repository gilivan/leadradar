import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Retry configuration: when the sandbox proxy is waking up it returns HTML
// instead of JSON (SESSION_DNS_FAILED). We detect this and retry automatically.
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 2500;

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempt = 0
): Promise<Response> {
  const res = await globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });

  // If the proxy returns a non-JSON content-type (HTML error page), retry
  const contentType = res.headers.get("content-type") ?? "";
  const isProxyError =
    !contentType.includes("application/json") &&
    (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 0);

  if (isProxyError && attempt < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    return fetchWithRetry(input, init, attempt + 1);
  }

  return res;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry up to 3 times on error with exponential backoff
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          // Don't retry auth errors
          if (error.message === UNAUTHED_ERR_MSG) return false;
          // Retry JSON parse errors (proxy waking up) up to 3 times
          if (error.message?.includes("is not valid JSON")) return failureCount < 3;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message === UNAUTHED_ERR_MSG) {
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    // Only log if it's not a retryable proxy error
    if (!(error instanceof TRPCClientError && error.message?.includes("is not valid JSON"))) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: fetchWithRetry,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
