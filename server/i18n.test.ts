import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { AR } from "../client/src/i18n/ar";
import { AGE_GROUPS, AI_CHARACTERS } from "@shared/characters";
import { BADGES, levelTitle } from "@shared/gamification";

const root = path.resolve(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "components" || entry.name === "demo" ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(entry.name) && !p.includes("ComponentShowcase") ? [p] : [];
  });
}

/** Every string literal passed to t("…") or T("…") in the client. */
function clientKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  const re = /(?<![\w.$])[tT]\(\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g;
  for (const file of sourceFiles(path.join(root, "client/src"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of Array.from(text.matchAll(re))) keys.set(new Function(`return ${m[1]}`)() as string, path.relative(root, file));
  }
  return keys;
}

const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");

describe("Arabic interface text", () => {
  it("covers every string the client passes to t() or T()", () => {
    const keys = clientKeys();
    expect(keys.size).toBeGreaterThan(400); // guards against the scan silently finding nothing
    const missing = Array.from(keys).filter(([k]) => !(k in AR)).map(([k, f]) => `${f}: ${JSON.stringify(k)}`);
    expect(missing).toEqual([]);
  });

  it("covers the English text that lives in shared data (guides, age groups, level titles, badges)", () => {
    const strings = [
      ...AI_CHARACTERS.flatMap(c => [c.name, c.description]),
      ...Object.values(AGE_GROUPS).map(g => g.name),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(levelTitle),
      ...BADGES.flatMap(b => [b.name, b.description]),
    ];
    expect(strings.filter(s => !(s in AR))).toEqual([]);
  });

  it("covers the error messages the server can return", () => {
    const limits: Record<string, string> = { MAX_STUDENTS_PER_CLASS: "60", MAX_CLASSES_PER_TEACHER: "20" };
    const found: string[] = [];
    for (const file of ["server/routers.ts", "server/_core/rateLimit.ts", "server/_core/trpc.ts"]) {
      const text = fs.readFileSync(path.join(root, file), "utf8");
      for (const m of Array.from(text.matchAll(/message: "([^"\n]*)"/g))) found.push(m[1]);
      for (const m of Array.from(text.matchAll(/message: `([^`\n]*)`/g))) found.push(m[1].replace(/\$\{(\w+)\}/g, (_, n) => limits[n] ?? `{${n}}`));
    }
    const routers = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
    found.push(routers.match(/const AI_UNAVAILABLE = "([^"]*)"/)![1]);
    const expected = found.filter(m => !m.includes("{")); // dynamic account/child limits are listed explicitly below
    expect(expected.length).toBeGreaterThan(15);
    expect(expected.filter(m => !(m in AR))).toEqual([]);
    for (const m of ["An account can have up to 400 students.", "You can add up to 6 children."]) expect(AR[m]).toBeTruthy();
  });

  it("keeps {placeholders} identical in both languages and never leaves a blank translation", () => {
    for (const [en, ar] of Object.entries(AR)) {
      expect(ar.trim(), en).not.toBe("");
      expect(placeholders(ar), en).toBe(placeholders(en));
    }
  });

  it("actually translates: every entry except the brand name contains Arabic letters", () => {
    for (const [en, ar] of Object.entries(AR)) {
      if (en === "Rated AI") continue;
      expect(/[ء-ي]/.test(ar), en).toBe(true);
    }
  });

  it("uses Western digits (0-9) consistently until educators decide otherwise", () => {
    for (const [en, ar] of Object.entries(AR)) expect(/[٠-٩]/.test(ar), en).toBe(false);
  });
});
