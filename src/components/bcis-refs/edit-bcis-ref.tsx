"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BcisRefForm } from "@/components/bcis-refs/bcis-ref-form";
import { Forbidden } from "@/components/forbidden";
import { PageHeading, secondaryButtonClassName } from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { asApiError, useApi } from "@/lib/api-client";
import { parseBcisRefBody } from "@/lib/bcis-refs";
import { BCIS_REFS_EDIT, hasPermission } from "@/lib/session";

export function EditBcisRef({ id }: { id: string }) {
  const router = useRouter();
  const [denied, setDenied] = useState<string | null>(null);
  const { user } = useSession();
  const canEdit = hasPermission(user, BCIS_REFS_EDIT);
  const request = useApi(canEdit ? `/api/bcis-refs/${id}` : null, parseBcisRefBody);
  const missing = request.error?.status === 404;

  useEffect(() => {
    if (missing) {
      router.replace("/bcis-refs");
    }
  }, [missing, router]);

  if (!canEdit || denied) {
    return <Forbidden message={denied ?? undefined} />;
  }

  if (missing) {
    return null;
  }

  if (request.loading) {
    return <p className="text-sm text-muted">Loading BCIS reference…</p>;
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

  const bcisRef = request.data;

  if (!bcisRef) {
    return null;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title="Edit BCIS reference"
        action={
          <Link href={`/bcis-refs/${bcisRef.id}`} className={secondaryButtonClassName}>
            Back
          </Link>
        }
      />
      <BcisRefForm
        key={bcisRef.id}
        bcisRef={bcisRef}
        onMissing={() => {
          router.replace("/bcis-refs");
        }}
        onForbidden={(message) => {
          setDenied(message);
        }}
      />
    </section>
  );
}
