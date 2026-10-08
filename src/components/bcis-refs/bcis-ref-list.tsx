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
import { parseBcisRefList, type BcisRef } from "@/lib/bcis-refs";
import { BCIS_REFS_CREATE, BCIS_REFS_VIEW, hasPermission } from "@/lib/session";

export function BcisRefList() {
  const { user } = useSession();
  const canView = hasPermission(user, BCIS_REFS_VIEW);
  const canCreate = hasPermission(user, BCIS_REFS_CREATE);
  const { data, error, loading } = useApi(
    canView ? "/api/bcis-refs" : null,
    parseBcisRefList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="BCIS references"
        action={
          canCreate ? (
            <Link href="/bcis-refs/new" className={primaryButtonClassName}>
              New BCIS reference
            </Link>
          ) : null
        }
      />
      {loading ? <p className="mt-6 text-sm text-gray-500">Loading BCIS references…</p> : null}
      {error ? (
        error.status === 403 ? (
          <div className="mt-8">
            <Forbidden message={error.message} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-error-600" role="alert">
            {asApiError(error).message}
          </p>
        )
      ) : null}
      {data ? <BcisRefRows bcisRefs={data} /> : null}
    </section>
  );
}

function BcisRefRows({ bcisRefs }: { bcisRefs: BcisRef[] }) {
  const [query, setQuery] = useState("");

  if (bcisRefs.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No BCIS references yet.</p>;
  }

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? bcisRefs.filter(
        (bcisRef) =>
          bcisRef.code.toLowerCase().includes(needle) ||
          bcisRef.name.toLowerCase().includes(needle),
      )
    : bcisRefs;

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="bcis-ref-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No BCIS references match.</p>
      ) : (
        <DataTable columns={["Code", "Name", "Status"]}>
          {rows.map((bcisRef) => (
            <tr key={bcisRef.id} className="hover:bg-gray-50">
              <td className="px-5 py-4 text-sm text-gray-500">{bcisRef.code}</td>
              <td className="px-5 py-4">
                <Link
                  href={`/bcis-refs/${bcisRef.id}`}
                  className="text-sm font-medium text-gray-800"
                >
                  {bcisRef.name}
                </Link>
              </td>
              <td className="px-5 py-4">
                <Badge tone={bcisRef.isActive ? "success" : "light"}>
                  {bcisRef.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
