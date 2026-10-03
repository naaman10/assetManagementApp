"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { useSession } from "@/components/session-provider";
import {
  hasAnyPermission,
  hasPermission,
  ROLE_AREA_PERMISSIONS,
  ROLES_CREATE,
  ROLES_VIEW,
  USER_AREA_PERMISSIONS,
  USERS_CREATE,
  USERS_VIEW,
  type SessionUser,
} from "@/lib/session";

export function AppHeader() {
  const pathname = usePathname();
  const { user } = useSession();
  const showUsers = hasAnyPermission(user, USER_AREA_PERMISSIONS);
  const showRoles = hasAnyPermission(user, ROLE_AREA_PERMISSIONS);

  return (
    <header className="flex flex-wrap items-center justify-between gap-6 px-8 py-8 sm:px-12">
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {showUsers ? (
            <NavLink
              href={areaHref(user, USERS_VIEW, USERS_CREATE, "/settings/users", "/settings/users/new")}
              active={pathname.startsWith("/settings/users")}
            >
              Users
            </NavLink>
          ) : null}
          {showRoles ? (
            <NavLink
              href={areaHref(user, ROLES_VIEW, ROLES_CREATE, "/settings/roles", "/settings/roles/new")}
              active={pathname.startsWith("/settings/roles")}
            >
              Roles
            </NavLink>
          ) : null}
        </nav>
      </div>
      <SignOutButton />
    </header>
  );
}

function areaHref(
  user: SessionUser,
  viewPermission: string,
  createPermission: string,
  listHref: string,
  createHref: string,
) {
  if (hasPermission(user, viewPermission)) {
    return listHref;
  }

  if (hasPermission(user, createPermission)) {
    return createHref;
  }

  return listHref;
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center rounded-full px-4 text-sm font-medium ${
        active ? "bg-inverse text-inverse-foreground" : "text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
