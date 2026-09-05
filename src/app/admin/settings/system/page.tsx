import { forbidden } from "next/navigation";
import { getUserEffectivePermissions, requirePermission } from "@/lib/auth/authorize";
import { getSafeOperationalStatus } from "@/lib/settings/system-status";
import { getScheduledJobsStatus } from "@/lib/settings/scheduled-jobs";
import { SettingsStatusCard } from "@/components/settings-status-card";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const actor = await requirePermission("settings.view");
  const permissions = await getUserEffectivePermissions(actor.id);
  if (!permissions.has("settings.update")) forbidden();

  const status = getSafeOperationalStatus();
  const jobsStatus = getScheduledJobsStatus();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a77b27]">Operations</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">System & Operations</h1>
        <p className="mt-1 text-sm text-slate-500">Read-only operational policy, environment status, and scheduled jobs monitoring.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsStatusCard
          title="Application Environment"
          provider={status.environment}
          status="Operational"
          detail="Environment label only; infrastructure secrets and environment values are not exposed."
        />
        <SettingsStatusCard
          title="Base Currency Policy"
          provider={status.baseCurrency}
          status="Operational"
          detail="All authoritative monetary workflows remain INR-only. This page performs no conversion or financial mutation."
        />
        <SettingsStatusCard
          title="Schema Management"
          provider="Deployment-managed"
          status="Operational"
          detail={status.schemaManagement}
        />
        <SettingsStatusCard
          title="Scheduled Jobs Scheduler"
          provider="No production scheduler configured"
          status="Not configured"
          detail={jobsStatus.message}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">Scheduled Jobs & Background Tasks Monitoring</h2>
          <p className="text-xs text-slate-500 mt-1">{jobsStatus.message}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Task Name</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Execution Schedule</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobsStatus.jobs.map((job) => (
                <tr key={job.key} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3.5 font-bold text-slate-900">{job.name}</td>
                  <td className="px-4 py-3.5 text-slate-600 max-w-xs">{job.purpose}</td>
                  <td className="px-4 py-3.5 font-mono text-slate-600">{job.schedule}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {job.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
