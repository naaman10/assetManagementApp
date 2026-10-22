"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { Nrm3ClassificationForm } from "@/components/nrm3-classifications/nrm3-classification-form";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseNrm3ClassificationBody } from "@/lib/nrm3-classifications";
import {
  NRM3_CLASSIFICATIONS_EDIT,
  NRM3_CLASSIFICATIONS_VIEW,
  hasPermission,
} from "@/lib/session";

export function EditNrm3Classification({ code }: { code: string }) {
  const router = useRouter();
  const [denied, setDenied] = useState<string | null>(null);
  const { user } = useSession();
  const canView = hasPermission(user, NRM3_CLASSIFICATIONS_VIEW);
  const canEdit = hasPermission(user, NRM3_CLASSIFICATIONS_EDIT);
  const allowed = canView && canEdit;
  const encoded = encodeURIComponent(code);
  const request = useApi(
    allowed ? `/api/nrm3-classifications/${encoded}` : null,
    parseNrm3ClassificationBody,
  );
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/nrm3-classifications");
    }
  }, [missing, router]);

  if (!canView || !canEdit || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading classification…</p>;
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

  const classification = request.data;

  if (!classification) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit NRM3 classification"
        action={
          <Link
            href={`/nrm3-classifications/${encoded}`}
            className={secondaryButtonClassName}
          >
            Back
          </Link>
        }
      />
      <Nrm3ClassificationForm
        key={classification.code}
        classification={classification}
        onMissing={() => {
          router.replace("/nrm3-classifications");
        }}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
