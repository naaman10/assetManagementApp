"use client";

export function SignOutButton() {
  async function signOut() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return;
    }

    // A client navigation can reuse the signed-in page after the cookie is cleared.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/sign-in");
  }

  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
      }}
      className="mt-3 inline-flex text-sm font-medium text-gray-500 hover:text-gray-800"
    >
      Sign out
    </button>
  );
}
