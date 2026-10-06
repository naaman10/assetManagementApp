"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { Badge, DataTable, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import {
  classificationLabel,
  parseAssetTypeBody,
  parseAssetTypeList,
} from "@/lib/asset-types";
import { ASSET_TYPES_EDIT, ASSET_TYPES_VIEW, hasPermission } from "@/lib/session";

export function AssetTypeDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, ASSET_TYPES_VIEW);
  const canEdit = hasPermission(user, ASSET_TYPES_EDIT);
  const typeRequest = useApi(canView ? `/api/asset-types/${id}` : null, parseAssetTypeBody);
  const listRequest = useApi(canView ? "/api/asset-types" : null, parseAssetTypeList);
  const missing = typeRequest.error?.status === 404 || listRequest.error?.status === 404;
  const forbidden =
    typeRequest.error?.status === 403
      ? typeRequest.error
      : listRequest.error?.status === 403
        ? listRequest.error
        : null;
  const error = typeRequest.error ?? listRequest.error;

  useEffect(() => {
    if (missing) {
      router.replace("/asset-types");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (typeRequest.loading || listRequest.loading) {
    return <p className="text-sm text-muted">Loading asset type…</p>;
  }

  if (forbidden) {
    return <Forbidden message={forbidden.message} />;
  }

  if (error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(error).message}
      </p>
    );
  }

  const assetType = typeRequest.data;
  const assetTypes = listRequest.data;

  if (!assetType || !assetTypes) {
    return null;
  }

  const parent = assetType.parentId
    ? (assetTypes.find((item) => item.id === assetType.parentId) ?? null)
    : null;
  const children = assetTypes.filter((item) => item.parentId === assetType.id);

  return (
    <div className="grid gap-8">
      <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Asset type</p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-800">{assetType.name}</h1>
            <Detail label="Code" value={assetType.code} />
            <Detail
              label="Classification"
              value={classificationLabel(assetType.classificationType)}
            />
            <div className="mt-3">
              <p className="text-sm text-muted">Parent</p>
              {assetType.parentId ? (
                <Link
                  href={`/asset-types/${assetType.parentId}`}
                  className="mt-1 block text-sm font-medium text-gray-800 hover:text-brand-500"
                >
                  {parent ? `${parent.code} · ${parent.name}` : "—"}
                </Link>
              ) : (
                <p className="mt-1 text-sm font-medium">—</p>
              )}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted">Description</p>
              {assetType.description ? (
                <p className="mt-1 text-sm leading-6 font-medium whitespace-pre-line">
                  {assetType.description}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-500">No description</p>
              )}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted">Status</p>
              <div className="mt-1">
                <Badge tone={assetType.isActive ? "success" : "light"}>
                  {assetType.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
          {canEdit ? (
            <Link
              href={`/asset-types/${assetType.id}/edit`}
              className={secondaryButtonClassName}
            >
              Edit
            </Link>
          ) : null}
        </div>
      </section>
      <section>
        {children.length === 0 ? (
          <p className="text-sm text-gray-500">No child asset types.</p>
        ) : (
          <DataTable columns={["Code", "Name", "Classification"]}>
            {children.map((child) => (
              <tr key={child.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-500">{child.code}</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/asset-types/${child.id}`}
                    className="text-sm font-medium text-gray-800"
                  >
                    {child.name}
                  </Link>
                </td>
                <td className="px-5 py-4 text-sm text-gray-500">
                  {classificationLabel(child.classificationType)}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
