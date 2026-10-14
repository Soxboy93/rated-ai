import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, t } from "@/i18n";
import { selectClass } from "@/parent/FamilyPanel";

export function StatusBadge({ suspended, admin }: { suspended: boolean; admin?: boolean }) {
  if (admin) return <span className="rounded-full border border-indigo-300 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-900">{t("Administrator")}</span>;
  return suspended
    ? <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-900">{t("Suspended")}</span>
    : <span className="rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-900">{t("Active")}</span>;
}

/** Accounts of one kind (schools or families), searchable and paged. */
export default function AccountList({ type, onOpen }: { type: "school" | "family"; onOpen: (userId: string) => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [page, setPage] = useState(0);
  const { data, isLoading } = trpc.admin.accounts.useQuery({ search: query || undefined, type, status: status || undefined, page });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const school = type === "school";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{school ? t("Teachers and schools") : t("Families")}</CardTitle>
        <CardDescription>{school ? t("Every school account. Open one to see its classes, students and lessons.") : t("Every family account. Open one to see its children.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(0); setQuery(search.trim()); }}>
          <Input className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Search by email or name")} aria-label={t("Search by email or name")} />
          <select className={selectClass} value={status} onChange={e => { setStatus(e.target.value as typeof status); setPage(0); }} aria-label={t("Status")}>
            <option value="">{t("All statuses")}</option>
            <option value="active">{t("Active")}</option>
            <option value="suspended">{t("Suspended")}</option>
          </select>
          <Button type="submit" variant="outline">{t("Search")}</Button>
        </form>
        {isLoading ? <p className="text-gray-600">{t("Loading…")}</p> : !data || data.rows.length === 0 ? <p className="text-gray-600">{t("No accounts match.")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b text-gray-600">{[t("Account"), t("Status"), t("Joined"), t("Last sign-in"), t("Students"), school ? t("Classes") : "", t("Lessons"), t("Flags to review")].filter(Boolean).map(h => <th key={h} className="px-2 py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-2 py-2"><button className="text-start font-medium text-brand-700 underline-offset-2 hover:underline" onClick={() => onOpen(r.id)}><bdi>{r.email}</bdi></button>{r.name && <span className="block text-xs text-gray-500"><bdi>{r.name}</bdi></span>}</td>
                    <td className="px-2 py-2"><StatusBadge suspended={!!r.suspendedAt} admin={r.role === "admin"} /></td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.createdAt ? fmtDate(r.createdAt) : "–"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{r.lastSignedIn ? fmtDate(r.lastSignedIn) : "–"}</td>
                    <td className="px-2 py-2 tabular-nums">{r.students}</td>
                    {school && <td className="px-2 py-2 tabular-nums">{r.classes}</td>}
                    <td className="px-2 py-2 tabular-nums">{r.lessons}</td>
                    <td className="px-2 py-2 tabular-nums">{r.flaggedOpen > 0 ? <b className="text-red-700">{r.flaggedOpen}</b> : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center gap-3 text-sm">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("Previous")}</Button>
            <span>{t("Page {a} of {b}", { a: page + 1, b: pages })}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>{t("Next")}</Button>
            <span className="text-gray-500">{t("{n} accounts", { n: data.total })}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
