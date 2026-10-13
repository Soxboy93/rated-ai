/**
 * Preview-only administrator data: made-up schools, families and students, so the admin console can be tried without
 * a server. Everything here is invented example data held in the page. Actions (suspend, delete) change it for the session.
 */
type Account = {
  id: string; email: string; name: string | null; accountType: "school" | "family"; role: "user" | "admin"; language: "ar" | "en" | null;
  createdAt: Date; lastSignedIn: Date; suspendedAt: Date | null; suspendedReason: string | null;
  classes: Array<{ id: string; name: string; grade: number; chat: boolean; search: boolean; focus: boolean }>;
  students: Array<{ id: string; childName: string; ageGroup: string; classId: string | null; xp: number; lastPlayedAt: Date | null; flaggedMessages: number }>;
  lessons: Array<{ id: string; title: string; subject: string; grade: number; updatedAt: Date }>;
  audit: Array<{ id: string; action: string; detail: string | null; createdAt: Date }>;
};
type Ctx = { DemoError: new (code: string, msg: string) => Error; uid: () => string; adminEmail: () => string };

const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day);

function seed(): Account[] {
  let n = 0;
  const student = (name: string, cls: string | null, xp: number, last: number | null, flags = 0) => ({ id: `ds-${++n}`, childName: name, ageGroup: "tweens", classId: cls, xp, lastPlayedAt: last === null ? null : ago(last), flaggedMessages: flags });
  const school = (i: number, email: string, name: string, joined: number, seen: number, classes: Array<[string, number]>, kids: string[], lessons: string[]): Account => {
    const cl = classes.map(([cn, g], k) => ({ id: `dc-${i}-${k}`, name: cn, grade: g, chat: true, search: true, focus: false }));
    return {
      id: `da-${i}`, email, name, accountType: "school", role: "user", language: "ar", createdAt: ago(joined), lastSignedIn: ago(seen), suspendedAt: null, suspendedReason: null, classes: cl,
      students: kids.map((k, j) => student(k, cl[j % cl.length].id, 80 + j * 55, j % 5 === 4 ? 12 : j % 3, j === 2 ? 1 : 0)),
      lessons: lessons.map((l, j) => ({ id: `dl-${i}-${j}`, title: l, subject: ["math", "science", "arabic", "english"][j % 4], grade: classes[0]?.[1] ?? 4, updatedAt: ago(j + 1) })),
      audit: [{ id: `au-${i}-1`, action: "consent_granted", detail: null, createdAt: ago(joined) }, { id: `au-${i}-2`, action: "class_created", detail: classes[0]?.[0] ?? null, createdAt: ago(joined - 1) }],
    };
  };
  const family = (i: number, email: string, joined: number, seen: number, kids: string[]): Account => ({
    id: `da-${i}`, email, name: null, accountType: "family", role: "user", language: "en", createdAt: ago(joined), lastSignedIn: ago(seen), suspendedAt: null, suspendedReason: null, classes: [],
    students: kids.map((k, j) => student(k, null, 40 + j * 70, j + 1)), lessons: [], audit: [{ id: `au-${i}-1`, action: "consent_granted", detail: null, createdAt: ago(joined) }],
  });
  return [
    school(1, "layla.m@alnoor-school.example", "Al Noor School", 40, 0, [["4A", 4], ["4B", 4]], ["Layla", "Omar", "Sara", "Yousef", "Maryam", "Ahmad", "Noor", "Khaled"], ["Adding fractions", "Plants and light", "Reading a story"]),
    school(2, "head@future-academy.example", "Future Academy", 25, 1, [["3A", 3], ["5C", 5]], ["Hamza", "Lina", "Tariq", "Dana", "Zaid", "Rana"], ["Times tables", "The water cycle"]),
    school(3, "teacher@bright-minds.example", "Bright Minds", 9, 3, [["2B", 2]], ["Salma", "Adam", "Mira"], ["Letters and sounds"]),
    school(4, "t.rashed@new-school.example", null as unknown as string, 2, 2, [], [], []),
    family(5, "hana.family@example.com", 30, 0, ["Ali", "Mariam"]),
    family(6, "dad.k@example.com", 12, 4, ["Karim"]),
    family(7, "parent.s@example.com", 5, 5, ["Samar", "Jad"]),
  ];
}

const FLAGGED_CHAT = [
  { role: "user", content: "someone hit me at school and I hate it", flagged: "review" },
  { role: "assistant", content: "I'm so sorry that happened to you. You deserve to feel safe, and it is not your fault. Please tell a grown-up you trust right now.", flagged: "safe" },
];

export function makeAdminHandlers(ctx: Ctx) {
  let accounts = seed();
  const actions: Array<{ id: string; adminEmail: string; action: string; detail: string | null; createdAt: Date }> = [];
  const find = (id: string) => { const a = accounts.find(x => x.id === id); if (!a) throw new ctx.DemoError("NOT_FOUND", "Account not found"); return a; };
  const note = (target: Account | null, action: string, detail?: string) => {
    actions.unshift({ id: ctx.uid(), adminEmail: ctx.adminEmail(), action: `admin_${action}`, detail: `${target?.email ?? ""}${detail ? `: ${detail}` : ""}`.replace(/^: /, "") || null, createdAt: new Date() });
    if (target) target.audit.unshift({ id: ctx.uid(), action: `support_${action}`, detail: `by ${ctx.adminEmail()}${detail ? `: ${detail}` : ""}`, createdAt: new Date() });
  };
  const studentOf = (profileId: string) => {
    for (const a of accounts) { const s = a.students.find(x => x.id === profileId); if (s) return { a, s }; }
    throw new ctx.DemoError("NOT_FOUND", "Child profile not found");
  };
  const manageable = (id: string) => { const a = find(id); if (a.role === "admin") throw new ctx.DemoError("FORBIDDEN", "Administrator accounts cannot be changed from the console."); return a; };

  return {
    "admin.overview": () => ({
      accounts: { family: accounts.filter(a => a.accountType === "family").length, school: accounts.filter(a => a.accountType === "school").length, admin: 1, suspended: accounts.filter(a => a.suspendedAt).length },
      students: accounts.reduce((n, a) => n + a.students.length, 0), signedInLast7Days: accounts.filter(a => +a.lastSignedIn > Date.now() - 7 * day).length, playsLast7Days: 214,
      lessons: accounts.reduce((n, a) => n + a.lessons.length, 0), flaggedOpen: accounts.reduce((n, a) => n + a.students.reduce((m, s) => m + s.flaggedMessages, 0), 0), newAccountsLast30Days: accounts.filter(a => +a.createdAt > Date.now() - 30 * day).length,
    }),
    "admin.accounts": ({ search, type, status, page }: { search?: string; type?: string; status?: string; page: number }) => {
      const q = (search ?? "").toLowerCase();
      const all = accounts.filter(a => (!type || a.accountType === type) && (!q || a.email.toLowerCase().includes(q) || (a.name ?? "").toLowerCase().includes(q)) && (!status || (status === "suspended" ? !!a.suspendedAt : !a.suspendedAt)));
      const PAGE = 25;
      return { total: all.length, pageSize: PAGE, rows: all.slice(page * PAGE, page * PAGE + PAGE).map(a => ({ id: a.id, email: a.email, name: a.name, accountType: a.accountType, role: a.role, language: a.language, createdAt: a.createdAt, lastSignedIn: a.lastSignedIn, suspendedAt: a.suspendedAt, students: a.students.length, classes: a.classes.length, lessons: a.lessons.length, flaggedOpen: a.students.reduce((n, s) => n + s.flaggedMessages, 0) })) };
    },
    "admin.account": ({ userId }: { userId: string }) => {
      const a = find(userId); note(a, "viewed_account");
      const { classes, students, lessons, audit, ...user } = a;
      return { user, consent: { version: "v1", language: user.language, grantedAt: a.createdAt }, classes, students, lessons, audit: audit.slice(0, 40) };
    },
    "admin.students": ({ search }: { search: string }) => {
      actions.unshift({ id: ctx.uid(), adminEmail: ctx.adminEmail(), action: "admin_searched_students", detail: search || "(all)", createdAt: new Date() });
      const q = search.toLowerCase();
      return accounts.flatMap(a => a.students.filter(s => !q || s.childName.toLowerCase().includes(q)).map(s => ({ id: s.id, childName: s.childName, ageGroup: s.ageGroup, userId: a.id, ownerEmail: a.email, ownerType: a.accountType, className: a.classes.find(c => c.id === s.classId)?.name ?? null, createdAt: a.createdAt }))).slice(0, 60);
    },
    "admin.student": ({ profileId }: { profileId: string }) => {
      const { a, s } = studentOf(profileId); note(a, "viewed_student", s.childName);
      const level = Math.floor(s.xp / 100) + 1;
      return {
        profile: { id: s.id, childName: s.childName, ageGroup: s.ageGroup, classId: s.classId, className: a.classes.find(c => c.id === s.classId)?.name ?? null },
        owner: { id: a.id, email: a.email, accountType: a.accountType },
        progress: { xp: s.xp, level, title: level > 3 ? "Adventurer" : "Explorer", streakDays: 2, totalPlays: 12, breakdown: [{ game: "math", plays: 7, correct: 52, total: 70 }, { game: "quiz", plays: 5, correct: 31, total: 40 }], lessons: a.lessons.slice(0, 2).map((l, i) => ({ shareId: `${l.id}-s`, title: l.title, result: i === 0 ? { correct: 2, total: 3 } : null })) },
      };
    },
    "admin.studentChats": ({ profileId }: { profileId: string }) => {
      const { a, s } = studentOf(profileId); note(a, "read_chats", s.childName);
      const flagged = s.flaggedMessages > 0;
      return [{ id: `sess-${s.id}`, createdAt: ago(1), messages: [
        { id: "m1", role: "user", content: "Why is the sky blue?", flagged: "safe" }, { id: "m2", role: "assistant", content: "Sunlight is made of many colours, and the blue light bounces around the most. Blue sparkles all over the sky!", flagged: "safe" },
        ...(flagged ? FLAGGED_CHAT.map((m, i) => ({ id: `mf${i}`, ...m })) : []),
      ] }];
    },
    "admin.suspend": ({ userId, suspended, reason }: { userId: string; suspended: boolean; reason?: string }) => { const a = manageable(userId); a.suspendedAt = suspended ? new Date() : null; a.suspendedReason = suspended ? reason || "Suspended by an administrator" : null; note(a, suspended ? "suspended" : "unsuspended", reason); return { success: true }; },
    "admin.setPassword": ({ userId }: { userId: string }) => { note(manageable(userId), "set_password"); return { success: true }; },
    "admin.resetPin": ({ userId }: { userId: string }) => { note(manageable(userId), "reset_pin"); return { success: true }; },
    "admin.deleteAccount": ({ userId, confirmEmail }: { userId: string; confirmEmail: string }) => {
      const a = manageable(userId);
      if (confirmEmail.trim().toLowerCase() !== a.email.toLowerCase()) throw new ctx.DemoError("BAD_REQUEST", "Type the account's email exactly to confirm.");
      actions.unshift({ id: ctx.uid(), adminEmail: ctx.adminEmail(), action: "admin_deleted_account", detail: `${a.email} (${a.accountType})`, createdAt: new Date() });
      accounts = accounts.filter(x => x.id !== a.id); return { success: true };
    },
    "admin.actions": () => actions.slice(0, 100),
  };
}
