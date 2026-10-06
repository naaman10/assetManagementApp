"use client";

import { useState } from "react";
import Link from "next/link";
import { Forbidden } from "@/components/forbidden";
import {
  Badge,
  DataTable,
  PageHeading,
  TextField,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import {
  classificationLabel,
  parseAssetTypeList,
  type AssetType,
} from "@/lib/asset-types";
import { ASSET_TYPES_VIEW, hasPermission } from "@/lib/session";

export function AssetTypeList() {
  const { user } = useSession();
  const canView = hasPermission(user, ASSET_TYPES_VIEW);
  const { data, error, loading } = useApi(
    canView ? "/api/asset-types" : null,
    parseAssetTypeList,
  );

  if (!canView) {
    return <Forbidden />;
  }

  return (
    <section>
      <PageHeading title="Asset types" />
      {loading ? <p className="mt-6 text-sm text-gray-500">Loading asset types…</p> : null}
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
      {data ? <AssetTypeRows assetTypes={data} /> : null}
    </section>
  );
}

function AssetTypeRows({ assetTypes }: { assetTypes: AssetType[] }) {
  const [query, setQuery] = useState("");

  if (assetTypes.length === 0) {
    return <p className="mt-6 text-sm text-gray-500">No asset types yet.</p>;
  }

  const needle = query.trim().toLowerCase();
  const rows = needle
    ? assetTypes.filter(
        (assetType) =>
          assetType.code.toLowerCase().includes(needle) ||
          assetType.name.toLowerCase().includes(needle),
      )
    : assetTypes;
  const byId = new Map(assetTypes.map((assetType) => [assetType.id, assetType]));

  return (
    <>
      <div className="mt-6 max-w-md">
        <TextField
          id="asset-type-search"
          label="Search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No asset types match.</p>
      ) : (
        <DataTable columns={["Code", "Name", "Classification", "Parent", "Status"]}>
          {rows.map((assetType) => {
            const parent = assetType.parentId
              ? (byId.get(assetType.parentId) ?? null)
              : null;

            return (
              <tr key={assetType.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-500">{assetType.code}</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/asset-types/${assetType.id}`}
                    className="text-sm font-medium text-gray-800"
                  >
                    {assetType.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">
                  {classificationLabel(assetType.classificationType)}
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">
                  {parent ? `${parent.code} · ${parent.name}` : "—"}
                </td>
                <td className="px-5 py-4">
                  <Badge tone={assetType.isActive ? "success" : "light"}>
                    {assetType.isActive ? "Active" : "Inactive"}
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
