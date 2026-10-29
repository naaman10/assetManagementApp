"use client";

import { Badge } from "@/components/form-controls";
import {
  reviewStatusLabel,
  type ProjectAssetReviewStatus,
} from "@/lib/projects";

export function ReviewStatusBadge({
  status,
}: {
  status: ProjectAssetReviewStatus;
}) {
  return <Badge tone={reviewStatusTone(status)}>{reviewStatusLabel(status)}</Badge>;
}

export function reviewStatusTone(
  status: ProjectAssetReviewStatus,
): "light" | "info" | "success" {
  switch (status) {
    case "todo":
      return "light";
    case "in_progress":
      return "info";
    case "done":
      return "success";
  }
}
