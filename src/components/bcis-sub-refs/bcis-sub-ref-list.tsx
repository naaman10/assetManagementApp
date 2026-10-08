"use client";

import { useState } from "react";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import {
  Badge,
  DataTable,
  PageHeading,
  TextField,
  primaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { formatBcisRef, parseBcisRefList, type BcisRef } from "@/lib/bcis-refs";
import { parseBcisSubRefList, type BcisSubRef } from "@/lib/bcis-sub-refs";
import {
  BCIS_REFS_VIEW,
  BCIS_SUB_REFS_CREATE,
  BCIS_SUB_REFS_VIEW,
  hasPermission,
} from "@/lib/session";

export function BcisSubRefList() {
  const { user } = useSession();
  const canView = hasPermission(user, BCIS_SUB_REFS_VIEW);
  const canCreate = hasPermission(user, BCIS_SUB_REFS_CREATE);
  const canViewRefs = hasPermission(user, BCIS_REFS_VIEW);
  const listRequest = useApi(
    canView ? "/api/bcis-sub-refs" : null,
    parseBcisSubRefList,
  );
  const refsRequest = useApi(
    canView && canViewRefs ? "/api/bcis-refs" : null,
    parseBcisRefList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  const refsLoading = canViewRefs && refsRequest.loading;

  return (
    <section>
      <PageHeading
        title="BCIS sub references"
        action={
          canCreate ? (
            <Link href="/bcis-sub-refs/new" className={primaryButtonClassName}>
              New BCIS sub reference
            </Link>
          ) : null
        }
      />
      {!listRequest.error && (listRequest.loading || refsLoading) ? (
        <p className="mt-6 text-sm text-gray-500">Loading BCIS sub references…</p>
      ) : null}
      {listRequest.error ? (
        listRequest.error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={listRequest.error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(listRequest.error).message}
          </p>
        )
      ) : null}
      {listRequest.data && !listRequest.loading && !refsLoading ? (
        <BcisSubRefRows
          bcisSubRefs={listRequest.data}
          bcisRefs={refsRequest.error ? null : refsRequest.data}
        />
      ) : null}
    </section>
  );
}

function BcisSubRefRows({
  bcisSubRefs,
  bcisRefs,
}: {
  bcisSubRefs: BcisSubRef[];
  bcisRefs: BcisRef[] | null;
}) {
  const [query, setQuery] = useState("");

  if (bcisSubRefs.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No BCIS sub references yet.</p>;
  }

  const parents = new Map((bcisRefs ?? []).map((bcisRef) => [bcisRef.id, bcisRef]));
  const needle = query.trim().toLowerCase();
  const rows = needle
    ? bcisSubRefs.filter(
        (bcisSubRef) =>
          bcisSubRef.code.toLowerCase().includes(needle) ||
          bcisSubRef.name.toLowerCase().includes(needle),
      )
    : bcisSubRefs;

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="bcis-sub-ref-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No BCIS sub references match.</p>
      ) : (
        <DataTable columns={["Code", "Name", "Reference", "Status"]}>
          {rows.map((bcisSubRef) => {
            const parent = bcisRefs ? (parents.get(bcisSubRef.bcisRefId) ?? null) : null;

            return (
              <tr key={bcisSubRef.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-500">{bcisSubRef.code}</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/bcis-sub-refs/${bcisSubRef.id}`}
                    className="text-sm font-medium text-gray-800"
                  >
                    {bcisSubRef.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">
                  {parent ? formatBcisRef(parent) : "—"}
                </td>
                <td className="px-5 py-4">
                  <Badge tone={bcisSubRef.isActive ? "success" : "light"}>
                    {bcisSubRef.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
