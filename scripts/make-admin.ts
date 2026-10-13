/**
 * Makes (or creates) an administrator account. Run on the server, where the database and JWT_SECRET are configured:
 *   pnpm admin:make you@example.com                      promote an existing account
 *   ADMIN_PASSWORD='long passphrase' pnpm admin:make you@example.com --create   create a new admin account
 * Administrators are never made by signing up, so nobody can claim the role by registering an email address first.
 */
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { hashPassword } from "../server/_core/auth";
import * as db from "../server/db";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const create = process.argv.includes("--create");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error("Usage: pnpm admin:make <email> [--create]"); process.exit(1); }

const existing = await db.getUserByEmail(email);
if (existing && create) { console.error("An account with that email already exists. Run without --create to promote it."); process.exit(1); }
if (!existing && !create) { console.error("No account with that email. Add --create (and set ADMIN_PASSWORD) to make one."); process.exit(1); }

if (existing) {
  await db.setUserRole(existing.id, "admin");
  await db.logAudit(existing.id, "admin_granted", "by server command");
  console.log(`${email} is now an administrator. Sign in, then set a PIN to open the admin console.`);
} else {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (password.length < 12) { console.error("Set ADMIN_PASSWORD to a passphrase of at least 12 characters."); process.exit(1); }
  const id = randomUUID();
  await db.createUser({ id, email, name: "Administrator", passwordHash: await hashPassword(password), loginMethod: "email", accountType: "school", role: "admin", lastSignedIn: new Date() });
  await db.logAudit(id, "admin_created", "by server command");
  console.log(`Administrator ${email} created. Sign in, then set a PIN to open the admin console.`);
}
process.exit(0);
