"use client";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    // A full load bypasses a cached signed-in redirect to this page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/sign-in");
  }

  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
      }}
      className="flex h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
    >
      Sign out
    </button>
  );
}
