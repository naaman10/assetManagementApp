export const AUTH_RETURN_PATH_KEY = "auth_return_path";

export function safeReturnPath(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }

  let path = value;

  try {
    path = decodeURIComponent(value);
  } catch {
    return "/";
  }

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.startsWith("/sign-in")
  ) {
    return "/";
  }

  return path;
}
