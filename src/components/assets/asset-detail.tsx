"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { assetStatusLabel, formatQuantity } from "@/components/assets/asset-table";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Forbidden } from "@/components/forbidden";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { CLIENTS_VIEW, hasPermission } from "@/lib/session";
import { parseAssetBody, parseSiteSummary } from "@/lib/sites";

export function AssetDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canView = hasPermission(user, CLIENTS_VIEW);
  const request = useApi(canView ? `/api/assets/${id}` : null, parseAssetBody);
  const siteRequest = useApi(
    canView && request.data ? `/api/sites/${request.data.location.siteId}` : null,
    parseSiteSummary,
  );
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/sites");
    }
  }, [missing, router]);

  if (!canView) {
    return <Forbidden />;
  }

  if (missing) {
    return null;
  }

  if (request.loading || siteRequest.loading) {
    return <p className="text-sm text-muted">Loading asset…</p>;
  }

  if (request.error?.status === 403) {
    return <Forbidden message={request.error.message} />;
  }

  if (request.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {asApiError(request.error).message}
      </p>
    );
  }

  if (siteRequest.error) {
    return (
      <p className="text-sm leading-6 text-ink" role="alert">
        {siteRequest.error.message}
      </p>
    );
  }

  const asset = request.data;
  const site = siteRequest.data;

  if (!asset || !site) {
    return null;
  }

  return (
    <section className="rounded-card bg-surface p-6 shadow-card sm:p-8">
      <Breadcrumbs
        current
        items={[
          { label: asset.client.name, href: `/clients/${asset.client.id}` },
          { label: site.name, href: `/sites/${site.id}` },
          {
            label: asset.location.name ?? asset.location.locationCode ?? "Location",
            href: `/locations/${asset.location.id}`,
          },
          { label: asset.assetName ?? asset.assetRef },
        ]}
      />
      <p className="mt-6 text-sm text-gray-500">Asset</p>
      <h1 className="mt-1 text-2xl font-semibold text-gray-800">
        {asset.assetName ?? asset.assetRef}
      </h1>
      <p className="mt-3 text-sm text-muted">Reference</p>
      <p className="mt-1 text-sm font-medium">{asset.assetRef}</p>
      <p className="mt-3 text-sm text-muted">Type</p>
      <p className="mt-1 text-sm font-medium">{asset.assetType.name}</p>
      <p className="mt-3 text-sm text-muted">Quantity</p>
      <p className="mt-1 text-sm font-medium">{formatQuantity(asset)}</p>
      <p className="mt-3 text-sm text-muted">Status</p>
      <p className="mt-1 text-sm font-medium">{assetStatusLabel(asset.status)}</p>
    </section>
  );
}
