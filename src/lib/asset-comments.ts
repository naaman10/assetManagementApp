export type AssetCommentUser = {
  id: string;
  email: string;
  name: string | null;
};

export type AssetComment = {
  id: string;
  assetId: string;
  body: string;
  author: AssetCommentUser;
  mentions: AssetCommentUser[];
  createdAt: string;
  updatedAt: string;
};

export type AssetCommentList = {
  commentCount: number;
  comments: AssetComment[];
};

export const MAX_COMMENT_BODY = 5000;
export const MAX_COMMENT_MENTIONS = 50;

export function parseAssetCommentList(data: unknown): AssetCommentList {
  const record = objectRecord(data, "comment list");
  const comments = parseComments(record.comments);

  return {
    commentCount: readCount(record.commentCount, comments.length),
    comments,
  };
}

export function parseAssetCommentBody(data: unknown): AssetComment {
  if (!data || typeof data !== "object" || !("comment" in data)) {
    throw new Error("The response was missing a comment.");
  }

  return parseAssetComment(data.comment);
}

export function parseAssetComment(value: unknown): AssetComment {
  const record = objectRecord(value, "comment");

  return {
    id: requiredString(record, "id"),
    assetId: requiredString(record, "assetId"),
    body: requiredString(record, "body"),
    author: parseUser(record.author),
    mentions: parseUsers(record.mentions),
    createdAt: requiredString(record, "createdAt"),
    updatedAt: requiredString(record, "updatedAt"),
  };
}

export function commentAuthorLabel(user: AssetCommentUser): string {
  return user.name ?? user.email;
}

export function formatCommentTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseComments(value: unknown): AssetComment[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseAssetComment);
}

function parseUsers(value: unknown): AssetCommentUser[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The response could not be read.");
  }

  return value.map(parseUser);
}

function parseUser(value: unknown): AssetCommentUser {
  const record = objectRecord(value, "user");

  return {
    id: requiredString(record, "id"),
    email: requiredString(record, "email"),
    name: optionalString(record, "name"),
  };
}

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

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
