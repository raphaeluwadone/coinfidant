import { queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export type SessionUser = { id: string; email: string; displayName: string | null };

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<SessionUser | null> => {
    try {
      const { user } = await api<{ user: SessionUser }>("/auth/me");
      return user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
});

/** Full-page navigation: the API redirects to Google and back to the app. */
export const GOOGLE_SIGN_IN_URL = "/api/auth/google";

export const logout = () => api<void>("/auth/logout", { method: "POST" });
