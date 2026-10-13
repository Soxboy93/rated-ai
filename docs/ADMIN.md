# Administrator console (superadmin)

For the owner of the platform. Lets you see every school and family account and every student, and help with support. Read this before you give anyone else access.

## Making an administrator

Administrators are made **on the server**, never by signing up:

```
pnpm admin:make you@example.com                                        # promote an existing account
ADMIN_PASSWORD='a long passphrase' pnpm admin:make you@example.com --create   # create a new admin (12+ characters)
```

Then sign in with that email. You land in the admin console and are asked to create an **admin PIN of at least 8 characters**. The PIN is a second lock: even if someone steals a signed-in browser session, the console stays locked until the PIN is entered, and it re-locks after 15 minutes.

(An earlier version let any email listed in `ADMIN_EMAILS` become an administrator when it registered. Because sign-up does not verify email ownership, anyone could have registered that address first. That option has been removed.)

## What an administrator can do

| Area | Can | Cannot |
|---|---|---|
| Overview | Totals: schools, families, students, activity, flags to review | |
| Accounts | Search and page every school and family account; open one to see its classes, class controls, students, lessons, consent status and its audit log | See a password. Sign in as the user. |
| Students | Search every student by first name; see level, games, lesson results; **read their conversations** (a separate, deliberate click) | Edit scores or chats |
| Support actions | Suspend or reactivate an account; set a temporary password for a locked-out owner; clear a forgotten PIN; permanently delete an account (type its email to confirm) | Change another administrator, or yourself |

A **suspended** account is signed out everywhere at once and cannot sign in. Nothing is deleted. Suspending does not apply to administrators, so you cannot lock yourself out.

## Everything is recorded, and the owner can see it

- Every look and every action is written twice: to the administrator's own record (the console's **Activity log**) and to the **account owner's audit log** ("Support staff viewed this account", "…read a student's conversations", "Account suspended by support", and so on, with the administrator's email).
- Deleting an account removes that account's own audit trail with it, so the deletion is recorded under the administrator only.
- Tell customers this in your privacy notice. It is also what makes the access defensible: access to children's data is limited to support, logged, and visible.

## Things to decide before launch

- **Who gets an admin account.** Every administrator can read children's conversations. Keep the number very small, use a named account for each person, and remove access when someone leaves (`UPDATE users SET role='user'`, or delete the account).
- **Legal basis and wording.** Staff access to children's data should be covered by the consent text, the privacy notice and a data-processing agreement, and checked against Jordan's Personal Data Protection Law (2023). The current consent wording does not yet mention support access. Ask a Jordanian lawyer.
- **Network protection.** On the real server, put the console behind extra protection (an IP allow-list or a VPN on `/api/trpc/admin.*`), and use HTTPS only.
- **Sessions last 30 days.** Changing a password does not sign out existing sessions; suspending does. For a suspected break-in, suspend first.
- **No password-reset email yet.** "Set a temporary password" exists because there is no self-service reset. Give the temporary password to the owner by a separate secure channel.
- **No two-factor beyond the PIN yet.** A real second factor (an authenticator app) is the next step for administrator accounts.

## Trying it

The Claude preview has a **See the admin console** button on the sign-in screen with made-up schools, families and students. Nothing there is real, and actions only change the page.
