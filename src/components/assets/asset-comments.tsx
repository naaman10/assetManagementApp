"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Badge,
  FieldMessages,
  FormBanner,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { useSession } from "@/components/session-provider";
import { ApiRequestError, apiRequest, asApiError, useApi } from "@/lib/api-client";
import {
  MAX_COMMENT_BODY,
  MAX_COMMENT_MENTIONS,
  commentAuthorLabel,
  formatCommentTime,
  parseAssetCommentBody,
  type AssetComment,
  type AssetCommentList,
} from "@/lib/asset-comments";
import { parseLeadUsers, type ProjectUser } from "@/lib/projects";

export function AssetCommentsPanel({
  assetId,
  comments,
  loading,
  error,
  onComments,
  onAssetMissing,
}: {
  assetId: string;
  comments: AssetCommentList | null;
  loading: boolean;
  error: string | null;
  onComments: (next: AssetCommentList) => void;
  onAssetMissing: () => void;
}) {
  const { user } = useSession();
  const usersRequest = useApi("/api/clients/users", parseLeadUsers);
  const hideMentions = usersRequest.error?.status === 403;
  const [body, setBody] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiRequestError | null>(null);
  const people = mergePeople(usersRequest.data ?? [], comments?.comments ?? []);
  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_COMMENT_BODY && !pending;
  const mentioned = people.filter((person) => mentionIds.includes(person.id));

  if (!comments) {
    if (loading) {
      return <p className="text-sm text-muted">Loading comments…</p>;
    }

    if (error) {
      return (
        <p className="text-sm leading-6 text-ink" role="alert">
          {error}
        </p>
      );
    }

    return null;
  }

  const list = comments;

  async function postComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setPending(true);
    setActionError(null);

    try {
      const payload: { body: string; mentionedUserIds?: string[] } = {
        body: trimmed,
      };

      if (!hideMentions && mentionIds.length > 0) {
        payload.mentionedUserIds = mentionIds.slice(0, MAX_COMMENT_MENTIONS);
      }

      const created = parseAssetCommentBody(
        await apiRequest(`/api/assets/${assetId}/comments`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
      onComments({
        commentCount: list.commentCount + 1,
        comments: [...list.comments, created],
      });
      setBody("");
      setMentionIds([]);
    } catch (caught) {
      setActionError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  async function removeComment(commentId: string) {
    if (deletingId) {
      return;
    }

    setDeletingId(commentId);
    setActionError(null);

    try {
      await apiRequest(`/api/comments/${commentId}`, { method: "DELETE" });
      onComments({
        commentCount: Math.max(0, list.commentCount - 1),
        comments: list.comments.filter((comment) => comment.id !== commentId),
      });
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onAssetMissing();
        return;
      }

      if (apiError.status === 403) {
        setActionError(
          new ApiRequestError(403, "Only the author can delete this comment."),
        );
        return;
      }

      setActionError(apiError);
    } finally {
      setDeletingId(null);
    }
  }

  function applyBody(nextBody: string, nextMentionIds?: string[]) {
    const clipped = nextBody.slice(0, MAX_COMMENT_BODY);
    setBody(clipped);
    setMentionIds(
      pruneMentionIds(nextMentionIds ?? mentionIds, clipped, people).slice(
        0,
        MAX_COMMENT_MENTIONS,
      ),
    );
  }

  function insertMention(person: ProjectUser, trigger: MentionTrigger) {
    const label = userLabel(person);
    const tag = `@${label}`;
    const before = body.slice(0, trigger.start);
    const after = body.slice(trigger.cursor);
    const spacer = after.length === 0 || after.startsWith(" ") || after.startsWith("\n") ? "" : " ";
    const nextBody = `${before}${tag}${spacer}${after}`;
    const nextIds = mentionIds.includes(person.id)
      ? mentionIds
      : [...mentionIds, person.id];
    applyBody(nextBody, nextIds);
  }

  function removeMention(personId: string) {
    const person = people.find((item) => item.id === personId);

    if (!person) {
      setMentionIds(mentionIds.filter((id) => id !== personId));
      return;
    }

    const tag = `@${userLabel(person)}`;
    applyBody(body.replace(tag, "").replace(/\s{2,}/g, " ").trimStart(), [
      ...mentionIds.filter((id) => id !== personId),
    ]);
  }

  return (
    <section className="flex min-w-0 flex-col gap-6">
      {error ? (
        <p className="text-sm leading-6 text-ink" role="alert">
          {error}
        </p>
      ) : null}
      {comments.comments.length === 0 ? (
        <p className="text-sm text-gray-500">No comments yet.</p>
      ) : (
        <ul className="flex min-w-0 flex-col gap-4">
          {comments.comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              currentUserId={user.id}
              deleting={deletingId === comment.id}
              onDelete={() => {
                void removeComment(comment.id);
              }}
            />
          ))}
        </ul>
      )}

      <form className="grid max-w-2xl gap-4" onSubmit={(event) => void postComment(event)}>
        <FormBanner
          message={bannerMessage(actionError?.message ?? null, actionError?.fieldErrors ?? {})}
        />
        <div>
          {!hideMentions && mentioned.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {mentioned.map((person) => (
                <li
                  key={person.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white py-1.5 pr-2 pl-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-gray-800">
                    @{userLabel(person)}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${userLabel(person)}`}
                    onClick={() => {
                      removeMention(person.id);
                    }}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
                  >
                    <span aria-hidden="true" className="block text-base leading-none">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <MentionTextarea
            id={`asset-${assetId}-comment-body`}
            value={body}
            people={hideMentions ? [] : people}
            disabled={pending || usersRequest.loading}
            loading={usersRequest.loading && !hideMentions}
            mentionEnabled={!hideMentions}
            onChange={(next) => {
              applyBody(next);
            }}
            onMention={insertMention}
          />
          <FieldMessages messages={actionError?.fieldErrors.body} />
          {usersRequest.error && usersRequest.error.status !== 403 ? (
            <p className="mt-1.5 text-sm text-error-500" role="alert">
              {asApiError(usersRequest.error).message}
            </p>
          ) : null}
          <FieldMessages messages={actionError?.fieldErrors.mentionedUserIds} />
        </div>
        <div>
          <button type="submit" disabled={!canSubmit} className={primaryButtonClassName}>
            {pending ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>
    </section>
  );
}

type MentionTrigger = {
  start: number;
  cursor: number;
  query: string;
};

function MentionTextarea({
  id,
  value,
  people,
  disabled,
  loading,
  mentionEnabled,
  onChange,
  onMention,
}: {
  id: string;
  value: string;
  people: ProjectUser[];
  disabled: boolean;
  loading: boolean;
  mentionEnabled: boolean;
  onChange: (value: string) => void;
  onMention: (person: ProjectUser, trigger: MentionTrigger) => void;
}) {
  const listId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [restoreCursor, setRestoreCursor] = useState<number | null>(null);
  const trigger = mentionEnabled ? mentionTriggerAt(value, cursor) : null;
  const matches =
    trigger == null ? [] : filterUsers(people, trigger.query).slice(0, 8);
  const open = Boolean(mentionEnabled && menuOpen && trigger);

  useEffect(() => {
    if (!open) {
      return;
    }

    setHighlight(0);
  }, [open, trigger?.query]);

  useEffect(() => {
    if (restoreCursor == null) {
      return;
    }

    const field = textareaRef.current;

    if (!field) {
      return;
    }

    field.focus();
    field.setSelectionRange(restoreCursor, restoreCursor);
    setCursor(restoreCursor);
    setRestoreCursor(null);
  }, [value, restoreCursor]);

  function syncCursor() {
    const next = textareaRef.current?.selectionStart ?? 0;
    setCursor(next);
    return next;
  }

  function selectPerson(person: ProjectUser) {
    if (!trigger) {
      return;
    }

    const label = userLabel(person);
    const after = value.slice(trigger.cursor);
    const spacer = after.length === 0 || after.startsWith(" ") || after.startsWith("\n") ? "" : " ";
    const inserted = `@${label}${spacer}`;
    onMention(person, trigger);
    setMenuOpen(false);
    setRestoreCursor(trigger.start + inserted.length);
  }

  return (
    <div className="relative mt-1.5">
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        maxLength={MAX_COMMENT_BODY}
        rows={4}
        disabled={disabled}
        placeholder={
          mentionEnabled ? "Write a comment… Use @ to mention people" : "Write a comment…"
        }
        aria-autocomplete={mentionEnabled ? "list" : undefined}
        aria-controls={open ? listId : undefined}
        aria-expanded={mentionEnabled ? open : undefined}
        role={mentionEnabled ? "combobox" : undefined}
        className={`${inputClassName} mt-0 h-auto min-h-28 py-3 resize-y`}
        onClick={() => {
          const next = syncCursor();
          const nextTrigger = mentionEnabled ? mentionTriggerAt(value, next) : null;
          setMenuOpen(Boolean(nextTrigger));
        }}
        onKeyUp={() => {
          syncCursor();
        }}
        onSelect={() => {
          syncCursor();
        }}
        onChange={(event) => {
          const nextValue = event.target.value.slice(0, MAX_COMMENT_BODY);
          const nextCursor = event.target.selectionStart ?? nextValue.length;
          onChange(nextValue);
          setCursor(nextCursor);
          const nextTrigger = mentionEnabled
            ? mentionTriggerAt(nextValue, nextCursor)
            : null;
          setMenuOpen(Boolean(nextTrigger));
        }}
        onKeyDown={(event) => {
          if (!open) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((current) =>
              matches.length === 0 ? 0 : (current + 1) % matches.length,
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((current) =>
              matches.length === 0
                ? 0
                : (current - 1 + matches.length) % matches.length,
            );
            return;
          }

          if (event.key === "Enter" || event.key === "Tab") {
            const match = matches[highlight];

            if (match) {
              event.preventDefault();
              selectPerson(match);
            }

            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setMenuOpen(false);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setMenuOpen(false);
          }, 100);
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="People"
          className="absolute right-0 left-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-theme-xs"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-gray-500">Loading people…</li>
          ) : matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No people match.</li>
          ) : (
            matches.map((person, index) => {
              const active = index === highlight;

              return (
                <li key={person.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setHighlight(index);
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      selectPerson(person);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
                      active ? "bg-brand-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-800">
                        {userLabel(person)}
                      </span>
                      {person.name ? (
                        <span className="block text-xs text-gray-500">{person.email}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

function CommentRow({
  comment,
  currentUserId,
  deleting,
  onDelete,
}: {
  comment: AssetComment;
  currentUserId: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  const isAuthor = comment.author.id === currentUserId;
  const mentionsMe = comment.mentions.some((mention) => mention.id === currentUserId);
  const authorLabel = commentAuthorLabel(comment.author);

  return (
    <li className="flex min-w-0 items-start gap-3">
      <AuthorAvatar name={authorLabel} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-sm text-gray-500">
            <span className="font-medium text-gray-800">{authorLabel}</span>
            <span className="mx-1.5 text-gray-300" aria-hidden="true">
              ·
            </span>
            <time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time>
          </p>
          {isAuthor ? <CommentMenu deleting={deleting} onDelete={onDelete} /> : null}
        </div>
        <div
          className={`mt-1.5 min-w-0 rounded-2xl rounded-tl-md border px-4 py-3 ${
            mentionsMe
              ? "border-brand-300 bg-brand-25"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <CommentBody
            body={comment.body}
            mentions={comment.mentions}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </li>
  );
}

function CommentBody({
  body,
  mentions,
  currentUserId,
}: {
  body: string;
  mentions: AssetComment["mentions"];
  currentUserId: string;
}) {
  const parts = splitBodyMentions(body, mentions);

  return (
    <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <Badge
            key={`${part.user.id}-${index}`}
            tone={part.user.id === currentUserId ? "success" : "light"}
          >
            @{commentAuthorLabel(part.user)}
          </Badge>
        ) : (
          <span key={`text-${index}`}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function splitBodyMentions(
  body: string,
  mentions: AssetComment["mentions"],
): Array<
  | { type: "text"; text: string }
  | { type: "mention"; user: AssetComment["mentions"][number] }
> {
  if (mentions.length === 0 || body.length === 0) {
    return [{ type: "text", text: body }];
  }

  const tagged = mentions
    .map((user) => ({ user, tag: `@${commentAuthorLabel(user)}` }))
    .sort((left, right) => right.tag.length - left.tag.length);
  const byTag = new Map(tagged.map((item) => [item.tag, item.user]));
  const pattern = tagged.map((item) => escapeRegExp(item.tag)).join("|");
  const matcher = new RegExp(pattern, "g");
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "mention"; user: AssetComment["mentions"][number] }
  > = [];
  let lastIndex = 0;

  for (const match of body.matchAll(matcher)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const user = byTag.get(tag);

    if (!user) {
      continue;
    }

    if (index > lastIndex) {
      parts.push({ type: "text", text: body.slice(lastIndex, index) });
    }

    parts.push({ type: "mention", user });
    lastIndex = index + tag.length;
  }

  if (lastIndex < body.length) {
    parts.push({ type: "text", text: body.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: body }];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function AuthorAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-medium text-brand-500"
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function CommentMenu({
  deleting,
  onDelete,
}: {
  deleting: boolean;
  onDelete: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
      setConfirming(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={deleting}
        onClick={() => {
          if (open) {
            setOpen(false);
            setConfirming(false);
            return;
          }

          setOpen(true);
          setConfirming(false);
        }}
        className="inline-flex size-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50"
      >
        <MoreIcon />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-theme-xs"
        >
          {confirming ? (
            <div className="grid gap-2 px-3 py-2">
              <p className="text-sm leading-5 text-gray-700">Delete this comment?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  role="menuitem"
                  disabled={deleting}
                  className={`${primaryButtonClassName} px-3 py-2`}
                  onClick={onDelete}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={deleting}
                  className={`${secondaryButtonClassName} px-3 py-2`}
                  onClick={() => {
                    setConfirming(false);
                    setOpen(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={deleting}
              onClick={() => {
                setConfirming(true);
              }}
              className="flex w-full px-3 py-2 text-left text-sm text-error-600 hover:bg-error-50 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  );
}

function mentionTriggerAt(value: string, cursor: number): MentionTrigger | null {
  const before = value.slice(0, cursor);
  const match = /(?:^|[\s([{])@([^\s@]*)$/.exec(before);

  if (!match) {
    return null;
  }

  const query = match[1] ?? "";
  const start = before.length - query.length - 1;

  return { start, cursor, query };
}

function pruneMentionIds(
  ids: string[],
  body: string,
  people: ProjectUser[],
): string[] {
  return ids.filter((id) => {
    const person = people.find((item) => item.id === id);

    if (!person) {
      return false;
    }

    return body.includes(`@${userLabel(person)}`);
  });
}

function filterUsers(users: ProjectUser[], query: string): ProjectUser[] {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return users;
  }

  return users.filter(
    (user) =>
      user.email.toLowerCase().includes(needle) ||
      (user.name?.toLowerCase().includes(needle) ?? false),
  );
}

function userLabel(user: ProjectUser): string {
  return user.name ?? user.email;
}

function mergePeople(catalog: ProjectUser[], comments: AssetComment[]): ProjectUser[] {
  const byId = new Map(catalog.map((person) => [person.id, person]));

  for (const comment of comments) {
    for (const person of [comment.author, ...comment.mentions]) {
      if (!byId.has(person.id)) {
        byId.set(person.id, person);
      }
    }
  }

  return [...byId.values()].sort((left, right) =>
    (left.name ?? left.email).localeCompare(right.name ?? right.email),
  );
}
