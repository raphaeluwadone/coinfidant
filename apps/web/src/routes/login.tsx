import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "../features/auth/AuthForm";

export const Route = createFileRoute("/login")({
  component: () => <AuthForm mode="login" />,
});
