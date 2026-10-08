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
import { parseMaintenanceTypeList, type MaintenanceType } from "@/lib/maintenance-types";
import {
  MAINTENANCE_TYPES_CREATE,
  MAINTENANCE_TYPES_VIEW,
  hasPermission,
} from "@/lib/session";

export function MaintenanceTypeList() {
  const { user } = useSession();
  const canView = hasPermission(user, MAINTENANCE_TYPES_VIEW);
  const canCreate = hasPermission(user, MAINTENANCE_TYPES_CREATE);
  const { data, error, loading } = useApi(
    canView ? "/api/maintenance-types" : null,
    parseMaintenanceTypeList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading
        title="Maintenance types"
        action={
          canCreate ? (
            <Link href="/maintenance-types/new" className={primaryButtonClassName}>
              New maintenance type
            </Link>
          ) : null
        }
      />
      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading maintenance types…</p>
      ) : null}
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
      {data ? <MaintenanceTypeRows maintenanceTypes={data} /> : null}
    </section>
  );
}

function MaintenanceTypeRows({ maintenanceTypes }: { maintenanceTypes: MaintenanceType[] }) {
  const [query, setQuery] = useState("");

  if (maintenanceTypes.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No maintenance types yet.</p>;
  }

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? maintenanceTypes.filter(
        (maintenanceType) =>
          maintenanceType.code.toLowerCase().includes(needle) ||
          maintenanceType.name.toLowerCase().includes(needle),
      )
    : maintenanceTypes;

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="maintenance-type-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No maintenance types match.</p>
      ) : (
        <DataTable columns={["Sort order", "Code", "Name", "Status"]}>
          {rows.map((maintenanceType) => (
            <tr key={maintenanceType.id} className="hover:bg-gray-50">
              <td className="px-5 py-4 text-sm text-gray-500">{maintenanceType.sortOrder}</td>
              <td className="px-5 py-4 text-sm text-gray-500">{maintenanceType.code}</td>
              <td className="px-5 py-4">
                <Link
                  href={`/maintenance-types/${maintenanceType.id}`}
                  className="text-sm font-medium text-gray-800"
                >
                  {maintenanceType.name}
                </Link>
              </td>
              <td className="px-5 py-4">
                <Badge tone={maintenanceType.isActive ? "success" : "light"}>
                  {maintenanceType.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
