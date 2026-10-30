"use client";

import Link from "next/link";
import { SitePlanTable } from "@/components/site-plans/site-plan-table";
import { PageHeading, primaryButtonClassName } from "@/components/form-controls";
import { Forbidden } from "@/components/forbidden";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseSitePlanList } from "@/lib/site-plans";
import { CLIENTS_EDIT, CLIENTS_VIEW, hasPermission } from "@/lib/session";

export function SitePlanList() {
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const canCreate = hasPermission(user, CLIENTS_EDIT);
  const request = useApi(canView ? "/api/site-plans" : null, parseSitePlanList);
  const sitePlans = request.data?.sitePlans;

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="Site Plans"
        action={
          canCreate ? (
            <Link href="/site-plans/new" className={primaryButtonClassName}>
              New site plan
            </Link>
          ) : null
        }
      />
      {request.loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading site plans…</p>
      ) : null}
      {request.error ? (
        <p className="mt-6 text-sm text-error-600" role="alert">
          {asApiError(request.error).message}
        </p>
      ) : null}
      {sitePlans && !request.error ? (
        sitePlans.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8">
            <p className="text-sm text-gray-700">No site plans yet.</p>
            {canCreate ? (
              <Link
                href="/site-plans/new"
                className={`${primaryButtonClassName} mt-4 inline-flex`}
              >
                New site plan
              </Link>
            ) : null}
          </div>
        ) : (
          <SitePlanTable sitePlans={sitePlans} />
        )
      ) : null}
    </section>
  );
}
