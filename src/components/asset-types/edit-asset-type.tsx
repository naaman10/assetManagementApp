"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssetTypeForm } from "@/components/asset-types/asset-type-form";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseAssetTypeBody, parseAssetTypeList } from "@/lib/asset-types";
import { ASSET_TYPES_EDIT, ASSET_TYPES_VIEW, hasPermission } from "@/lib/session";

export function EditAssetType({ id }: { id: string }) {
  const router = useRouter();
  const [denied, setDenied] = useState<string | null>(null);
  const { user } = useSession();
  const canView = hasPermission(user, ASSET_TYPES_VIEW);
  const canEdit = hasPermission(user, ASSET_TYPES_EDIT);
  const allowed = canView && canEdit;
  const typeRequest = useApi(allowed ? `/api/asset-types/${id}` : null, parseAssetTypeBody);
  const listRequest = useApi(allowed ? "/api/asset-types" : null, parseAssetTypeList);
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

  if (!canView || !canEdit || denied) {
    return <Forbidden message={denied ?? undefined} />;
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

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit asset type"
        action={
          <Link href={`/asset-types/${assetType.id}`} className={secondaryButtonClassName}>
            Back
          </Link>
        }
      />
      <AssetTypeForm
        key={assetType.id}
        assetType={assetType}
        assetTypes={assetTypes}
        onMissing={() => {
          router.replace("/asset-types");
        }}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
