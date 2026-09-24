import { serve } from "@hono/node-server";
import { app } from "./app";
import { pruneExpiredSessions } from "./auth/session";

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, () => console.log(`api on http://localhost:${port}`));

setInterval(() => pruneExpiredSessions().catch(console.error), 60 * 60 * 1000);
