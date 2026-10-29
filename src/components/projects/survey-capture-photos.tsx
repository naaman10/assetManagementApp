"use client";

import { RecordPhotos } from "@/components/photos/record-photos";
import { apiRequest, asApiError } from "@/lib/api-client";
import {
  MAX_SURVEY_PHOTOS,
  SURVEY_PHOTO_LIMIT_MESSAGE,
  parseSurveyPhotoBody,
  surveyPhotoFileProblem,
  type SurveyPhoto,
} from "@/lib/survey-records";

export function SurveyCapturePhotos({
  photos,
  surveyRecordId,
  canEdit,
  required,
  onChange,
  onRefresh,
}: {
  photos: SurveyPhoto[];
  surveyRecordId: string | null;
  canEdit: boolean;
  required: boolean;
  onChange: (photos: SurveyPhoto[]) => void;
  onRefresh?: () => Promise<boolean>;
}) {
  const enabled = Boolean(surveyRecordId);
  const atLimit = photos.length >= MAX_SURVEY_PHOTOS;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700">
          Photos
          {required ? <span className="text-error-500"> *</span> : null}
        </p>
        <p className="text-xs text-gray-500">
          {photos.length} of {MAX_SURVEY_PHOTOS}
        </p>
      </div>
      {required && enabled && photos.length === 0 ? (
        <p className="text-sm text-gray-500">Add at least one photo.</p>
      ) : null}
      <RecordPhotos
        photos={photos}
        canEdit={canEdit}
        disabled={!enabled || atLimit}
        disabledMessage={
          !enabled
            ? "Save the survey first, then add photos."
            : atLimit
              ? SURVEY_PHOTO_LIMIT_MESSAGE
              : null
        }
        countLabel={null}
        onUpload={async (files) => {
          if (!surveyRecordId) {
            return "Save the survey first, then add photos.";
          }

          return uploadSurveyPhotos(surveyRecordId, photos, files, onChange);
        }}
        onDelete={
          surveyRecordId
            ? async (photoId) => {
                try {
                  await apiRequest(
                    `/api/survey-records/${surveyRecordId}/photos/${photoId}`,
                    { method: "DELETE" },
                  );
                  onChange(photos.filter((photo) => photo.id !== photoId));
                  return null;
                } catch (caught) {
                  return asApiError(caught).message;
                }
              }
            : undefined
        }
        onRefresh={onRefresh}
      />
    </div>
  );
}

export async function uploadSurveyPhotos(
  surveyRecordId: string,
  current: SurveyPhoto[],
  files: File[],
  onChange: (photos: SurveyPhoto[]) => void,
): Promise<string | null> {
  let next = [...current];
  let problem: string | null = null;
  let uploaded = 0;

  for (const file of files) {
    if (next.length >= MAX_SURVEY_PHOTOS) {
      problem = SURVEY_PHOTO_LIMIT_MESSAGE;
      break;
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const fileProblem = surveyPhotoFileProblem(bytes, file.size);

    if (fileProblem) {
      problem = fileProblem;
      break;
    }

    const body = new FormData();
    body.set("photo", file);

    try {
      const photo = parseSurveyPhotoBody(
        await apiRequest(`/api/survey-records/${surveyRecordId}/photos`, {
          method: "POST",
          body,
        }),
      );
      next = [...next, photo];
      uploaded += 1;
      onChange(next);
    } catch (caught) {
      problem = asApiError(caught).message;
      break;
    }
  }

  if (uploaded === 0 && !problem) {
    return null;
  }

  return problem;
}
