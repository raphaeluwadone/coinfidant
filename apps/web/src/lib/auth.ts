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

export const login = (email: string, password: string) =>
  api<{ user: SessionUser }>("/auth/login", { method: "POST", json: { email, password } });

export const signup = (email: string, password: string, displayName?: string) =>
  api<{ user: SessionUser }>("/auth/signup", { method: "POST", json: { email, password, displayName } });

export const logout = () => api<void>("/auth/logout", { method: "POST" });
