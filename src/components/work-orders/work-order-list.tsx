"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WorkOrderPanel } from "@/components/work-orders/work-order-panel";
import { PageHeading } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { apiRequest, asApiError, useApi } from "@/lib/api-client";
import { CLIENTS_VIEW, MAINTENANCE_TYPES_VIEW, hasPermission } from "@/lib/session";
import {
  parseWorkOrderBody,
  parseWorkOrderList,
  type WorkOrder,
  type WorkOrderList,
} from "@/lib/work-orders";

export function WorkOrderList() {
  return (
    <Suspense fallback={<WorkOrderListBody orderId={null} />}>
      <WorkOrderListQuery />
    </Suspense>
  );
}

function WorkOrderListQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orderParam = searchParams.get("order");
  const orderId = orderParam && orderParam.length > 0 ? orderParam : null;

  function clearOrderParam() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("order");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  return (
    <WorkOrderListBody
      orderId={orderId}
      onCloseOrder={orderId ? clearOrderParam : undefined}
    />
  );
}

function WorkOrderListBody({
  orderId,
  onCloseOrder,
}: {
  orderId: string | null;
  onCloseOrder?: () => void;
}) {
  const { user } = useSession();
  const canPickTypes = hasPermission(user, MAINTENANCE_TYPES_VIEW);
  const canChooseAsset = hasPermission(user, CLIENTS_VIEW);
  const request = useApi("/api/work-orders", parseWorkOrderList);
  const [saved, setSaved] = useState<WorkOrderList | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [opened, setOpened] = useState<{
    id: string;
    order: WorkOrder | null;
    error: string | null;
  } | null>(null);
  const orders = saved ?? request.data;

  if ((opened?.id ?? null) !== orderId) {
    setOpened(orderId ? { id: orderId, order: null, error: null } : null);
  }

  useEffect(() => {
    if (!orderId) {
      return;
    }

    let cancelled = false;

    apiRequest(`/api/work-orders/${orderId}`)
      .then((body) => {
        if (!cancelled) {
          setOpened({ id: orderId, order: parseWorkOrderBody(body), error: null });
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }

        const apiError = asApiError(caught);
        setOpened({
          id: orderId,
          order: null,
          error: apiError.status === 404 ? null : apiError.message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function reload() {
    try {
      setSaved(parseWorkOrderList(await apiRequest("/api/work-orders")));
      setReloadError(null);
    } catch (error) {
      setReloadError(asApiError(error).message);
    }
  }

  const orderError = opened?.id === orderId ? opened.error : null;

  return (
    <section>
      <PageHeading title="Work orders" />
      <div className="mt-6">
        <WorkOrderPanel
          orders={orders}
          loading={request.loading && !orders}
          error={orderError ?? reloadError ?? (orders ? null : (request.error?.message ?? null))}
          canCreate={canPickTypes && canChooseAsset}
          canEdit={canPickTypes}
          onReload={reload}
          requestedOrderId={orderId}
          requestedOrder={opened?.order ?? null}
          onRequestedOrderClose={onCloseOrder}
        />
      </div>
    </section>
  );
}
