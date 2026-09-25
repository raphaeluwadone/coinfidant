# Deploying Coinfidant

One Fly.io app runs the API and serves the built PWA from the same origin. Postgres runs as a separate Fly
database. Every deploy builds the `Dockerfile`, runs `node dist/release.js` (creates the `coinfidant_app` role if
missing, then migrates as the owner), and only then moves traffic to the new machine.

## First deploy

1. Install `flyctl` and sign in: `fly auth login`.
2. Pick a name and set it as `app` in `fly.toml`, then create the app: `fly apps create <name>`.
3. Create the database in the same region (`lhr`). Fly Managed Postgres (`fly mpg create`) includes automated
   backups; the older unmanaged Fly Postgres does not, so use Managed. Note the owner connection string it prints.
   Both run on Fly's private WireGuard network, so traffic between the app and the database is encrypted.
4. Google OAuth: in Google Cloud Console add `https://<name>.fly.dev/api/auth/google/callback` as an authorised
   redirect URI on a **production** OAuth client (keep the local one separate).
5. Web push: `npx web-push generate-vapid-keys` once. Keep the private key only in Fly secrets.
6. Set secrets. Generate each password and secret fresh; never reuse local or CI values.

   ```bash
   fly secrets set \
     MIGRATION_DATABASE_URL='<owner connection string>' \
     APP_DB_PASSWORD='<new random password>' \
     DATABASE_URL='<same host and db, user coinfidant_app, APP_DB_PASSWORD>' \
     JWT_SECRET='<openssl rand -base64 48>' \
     WEB_ORIGIN='https://<name>.fly.dev' \
     GOOGLE_CLIENT_ID='...' GOOGLE_CLIENT_SECRET='...' \
     GOOGLE_CALLBACK_URL='https://<name>.fly.dev/api/auth/google/callback' \
     VAPID_PUBLIC_KEY='...' VAPID_PRIVATE_KEY='...' VAPID_SUBJECT='mailto:<your email>' \
     ANTHROPIC_API_KEY='...'
   ```

   `ANTHROPIC_API_KEY` and the `VAPID_*` values are optional; without them the coach and push report themselves
   unavailable and everything else works.

7. `fly deploy`. Watch the release step in the output: it must print `migrations applied`.
8. Check `https://<name>.fly.dev/api/health` returns `{"ok":true}`, sign in, and install the app from the browser.

## Every deploy after that

Merge to `main` with CI green, then `fly deploy`. Migrations that drop or rename columns must ship in two deploys
(add, then remove) so the running machine never meets a schema it doesn't know.

## Monitoring

- Fly polls `/api/health` every 30s (it also checks the database) and restarts a failing machine.
- Logs are one JSON object per line: `fly logs`, or the Fly dashboard's log search. Request logs carry method,
  path with ids masked, status and duration. They never include bodies, query strings, cookies or emails.
- Worth a look weekly: 5xx counts (`"status":5`), `"context":"checkin"` errors, and coach failures (`coach_failed`).

## Backups

- **Primary:** Managed Postgres's automated backups. Check the retention on the database's dashboard page.
- **Off-site:** `.github/workflows/backup.yml` dumps nightly, encrypts with AES-256 (gpg, symmetric) and keeps the
  file as a workflow artifact for 14 days. It needs:
  - secret `FLY_BACKUP_TOKEN`: a deploy token scoped to the database app only (`fly tokens create deploy -a <db app>`),
  - secret `BACKUP_DATABASE_URL`: the owner connection string with the host set to `localhost:15432`,
  - secret `BACKUP_PASSPHRASE`: a long random passphrase stored in your password manager, not only in GitHub,
  - variable `FLY_DB_APP`: the database app's name.

  Run it once by hand (Actions → Backup → Run workflow) and test a restore before relying on it. Pin
  `superfly/flyctl-actions` to a commit SHA once you've confirmed it works.

### Restore

```bash
gpg --decrypt coinfidant-<stamp>.dump.gpg > restore.dump
pg_restore --no-owner --dbname '<owner connection string>' --clean --if-exists restore.dump
```

Restore into a fresh database first and point a staging app at it before touching production. Delete the
decrypted file afterwards.

## Data export and account deletion

Settings has both. Export downloads everything the user owns as JSON (money in minor units). Delete removes the
user and their budgets immediately; nothing is kept apart from what is still inside backups, which age out with
their retention window.
