import {
  MAX_HISTORY_PHOTO_BYTES,
  photoFileProblem as historyPhotoFileProblem,
  safePhotoUrl,
} from "@/lib/maintenance-history";

export type SurveyPhoto = {
  id: string;
  url: string;
  contentType: string;
  createdAt: string;
};

export const MAX_SURVEY_PHOTOS = 20;
export const MAX_SURVEY_PHOTO_BYTES = MAX_HISTORY_PHOTO_BYTES;
export const SURVEY_PHOTO_LIMIT_MESSAGE =
  "A survey record can have at most 20 photos.";

export function parseSurveyPhoto(value: unknown): SurveyPhoto {
  const record = objectRecord(value, "photo");

  return {
    id: requiredString(record, "id"),
    url: requiredString(record, "url"),
    contentType: requiredString(record, "contentType"),
    createdAt: requiredString(record, "createdAt"),
  };
}

export function parseSurveyPhotoList(value: unknown): SurveyPhoto[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseSurveyPhoto);
}

export function parseSurveyPhotoBody(data: unknown): SurveyPhoto {
  if (!data || typeof data !== "object" || !("photo" in data)) {
    throw new Error("The response was missing a photo.");
  }

  return parseSurveyPhoto(data.photo);
}

export function surveyPhotoFileProblem(bytes: Uint8Array, size: number): string | null {
  return historyPhotoFileProblem(bytes, size);
}

export { safePhotoUrl };

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`The response was missing a ${label}.`);
  }

  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error("The response could not be read.");
  }

  return value;
}
