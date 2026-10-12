# Deploying Rated AI (rated-ai.com)

The app is a single Node process (Express + tRPC) that also serves the built React client. It needs MySQL/MariaDB and an OpenAI-compatible LLM API. It no longer depends on Manus.

## 1. Requirements
- Node 20+, pnpm 10
- MySQL 8 or MariaDB 10.6+
- An OpenAI-compatible API key (OpenAI, Azure OpenAI, OpenRouter, a self-hosted vLLM, …)
- HTTPS termination in front of the app (Caddy, nginx, Cloudflare, a platform load balancer). Session cookies are marked `Secure` when the request arrives over HTTPS (`X-Forwarded-Proto: https`).

## 2. Configure
Copy `.env.example` to `.env` (or set variables in your platform's secret store) and fill it in. **Never commit real values.** `JWT_SECRET` must be at least 32 random characters; the server refuses to issue tokens without it.

## 3. Database
```bash
pnpm install --frozen-lockfile
pnpm db:push        # drizzle-kit generate + migrate (needs DATABASE_URL)
```
Migrations `0009`–`0012` add `users.passwordHash`, a unique constraint on `users.email`, `chatSessions.characterId/ageGroup`, a unique constraint on `accessibility_settings.userId`, and millisecond precision on `chatMessages.createdAt` (so replies sort after the message they answer). `0011` adds `parental_consents`, `audit_events` and `chatSessions.profileId`. Verified: all 13 migrations apply cleanly to an empty MariaDB 10.11, and `0011` applies to a database that already had users. Set `PRIVACY_CONTACT_EMAIL` so parents see who to contact.
Any rows written under the old shared `"anonymous"` user by the previous version belong to nobody; review and delete them (they may contain children's chats) before launch.

## 4. Build and run
```bash
pnpm build
pnpm start          # NODE_ENV=production node dist/index.js
```
Health: `GET /api/trpc/system.health?input={"json":{"timestamp":0}}`.

## 5. DNS and proxy for rated-ai.com
Point `rated-ai.com` (and `www`) at your proxy; proxy to `localhost:$PORT`; forward `X-Forwarded-For` and `X-Forwarded-Proto`. The app sets `trust proxy` to 1 hop, so run exactly one proxy in front of it or adjust `app.set("trust proxy", …)` in `server/_core/index.ts`.

## 5b. Fastest path: Docker Compose on a VPS (includes HTTPS)
On any Linux server with Docker (for example a Hostinger VPS) and the domain's DNS `A` records (`@` and `www`) pointing at the server's IP:
```bash
git clone https://github.com/Soxboy93/rated-ai && cd rated-ai
git checkout claude/parent-auth-safety-provider-neutral   # until merged
cp .env.example .env    # fill JWT_SECRET, LLM_API_KEY, DB_PASSWORD, DB_ROOT_PASSWORD
docker compose up -d --build
```
Caddy obtains the TLS certificate automatically once DNS resolves to the server and ports 80/443 are open. Migrations run before the app starts. This bundle has not been run in the authoring environment (the Docker client was present but no daemon, so images were not built; the compose file was only syntax-checked with `docker compose config`), so expect to debug the first start.

## 5c. Server that already runs CyberPanel / OpenLiteSpeed (keep your other sites)
Do **not** use `docker-compose.yml` there (its Caddy service wants ports 80/443). Use `docker-compose.cyberpanel.yml`, which publishes the app on `127.0.0.1:3000` only and keeps its own database in a container (no clash with the host's MariaDB).

1. **Back up first**: take a Hostinger VPS snapshot. Docker edits firewall rules and this server hosts other sites.
2. Install Docker (AlmaLinux 9):
   ```bash
   dnf -y install dnf-plugins-core git
   dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
   dnf -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
   systemctl enable --now docker
   ```
3. Clone, configure and start:
   ```bash
   git clone https://github.com/Soxboy93/rated-ai /opt/rated-ai && cd /opt/rated-ai
   git checkout claude/parent-auth-safety-provider-neutral
   cp .env.example .env
   echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env
   echo "DB_PASSWORD=$(openssl rand -hex 16)" >> .env
   echo "DB_ROOT_PASSWORD=$(openssl rand -hex 16)" >> .env
   nano .env        # set LLM_API_KEY; remove the empty duplicate JWT_SECRET/DB_* lines
   docker compose -f docker-compose.cyberpanel.yml up -d --build
   curl -s localhost:3000/api/trpc/auth.me     # expect {"result":{"data":{"json":null}}}
   ```
4. In CyberPanel: **Websites → Create Website** for `rated-ai.com` (add `www` as an alias/child domain if wanted). Point Cloudflare DNS at the server first (DNS-only/grey cloud while issuing the certificate), then **SSL → Issue SSL** for the site.
5. Proxy to the app. Open the site's **vHost Conf** (Websites → List Websites → Manage → vHost Conf) and add:
   ```
   extprocessor ratedai {
     type                    proxy
     address                 127.0.0.1:3000
     maxConns                100
     pcKeepAliveTimeout      60
     initTimeout             60
     retryTimeout            0
     respBuffer              0
   }
   ```
   Then in **Rewrite Rules** for the site:
   ```
   RewriteEngine On
   RewriteRule ^(.*)$ http://ratedai/$1 [P,L]
   ```
   Save, and restart LiteSpeed from CyberPanel if it does not reload by itself. This has not been tested against a real CyberPanel here; syntax follows OpenLiteSpeed's documented proxy extprocessor, so compare with the OpenLiteSpeed docs if it errors.
6. Visit `https://rated-ai.com`.

## 6. Known operational limits
- Rate limiting is in-memory, per process. Run a single instance, or move `server/_core/rateLimit.ts` to a shared store (Redis) before scaling out.
- Email delivery (weekly summaries, password reset, email verification) is not implemented. There is no password-reset flow yet.
- Daily time limits / allowed hours are stored but not enforced.
- Moderation is keyword screening plus an optional provider moderation call; it is not a certified or complete safety system.
- Image generation returns base64 `data:` URLs (no object storage). Generated pictures are not saved.
- No backups, monitoring, or log retention are configured by this repository.
