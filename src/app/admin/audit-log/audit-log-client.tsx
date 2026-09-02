"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";

type AuditLogDTO = {
  id: string;
  actor: { id: string; name: string; email: string };
  action: string;
  entityType: string;
  entityId: string | null;
  branchId: string | null;
  metadataJson: string | null;
  createdAt: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

export function AuditLogClient({ initialLogs }: { initialLogs: AuditLogDTO[] }) {
  const logs = initialLogs;
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.name.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.email.toLowerCase().includes(search.toLowerCase());
    const matchesEntity = !entityFilter || l.entityType === entityFilter;
    return matchesSearch && matchesEntity;
  });

  const entityTypes = Array.from(new Set(logs.map((l) => l.entityType)));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Administrative Audit Log</h1>
        <p className="text-xs text-slate-500 mt-1">
          Read-only administrative history tracking user management, role assignments, status changes, and permission edits.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit actions or actor email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        >
          <option value="">All Entity Types</option>
          {entityTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
      </div>

      {/* Log Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                      {dateTimeFormatter.format(new Date(l.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{l.actor.name}</div>
                      <div className="text-xs text-slate-500">{l.actor.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200/60 font-mono">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-semibold">
                      {l.entityType} {l.entityId ? <span className="font-mono text-slate-400">({l.entityId.slice(0, 8)}...)</span> : ""}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 max-w-xs truncate">
                      {l.metadataJson ? l.metadataJson : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                    No administrative audit events logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
