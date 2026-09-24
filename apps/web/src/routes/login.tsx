import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SignIn } from "../features/auth/AuthForm";
import { meQuery } from "../lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ error: z.string().max(32).optional() }),
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQuery)) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  return <SignIn error={Route.useSearch().error} />;
}
