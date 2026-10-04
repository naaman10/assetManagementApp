"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { useSession } from "@/components/session-provider";
import {
  CLIENTS_VIEW,
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
  const showClients = hasPermission(user, CLIENTS_VIEW);
  const showUsers = hasAnyPermission(user, USER_AREA_PERMISSIONS);
  const showRoles = hasAnyPermission(user, ROLE_AREA_PERMISSIONS);

  return (
    <>
      <Link href="/" aria-label="Home" className="fixed top-4 left-4 z-20">
        <Logo />
      </Link>
      <aside className="fixed top-20 left-4 z-20 flex h-[calc(100dvh-6rem)] w-60 flex-col overflow-hidden rounded-card bg-black px-4 py-6 text-inverse-foreground shadow-[0_16px_40px_rgba(26,26,26,0.2)] [&_a:focus-visible]:outline-inverse-foreground [&_button:focus-visible]:outline-inverse-foreground">
        <nav
          aria-label="Main"
          className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto"
        >
          {showClients ? (
            <NavLink href="/clients" active={pathname.startsWith("/clients")}>
              Clients
            </NavLink>
          ) : null}
          {showClients ? (
            <NavLink href="/sites" active={pathname.startsWith("/sites")}>
              Sites
            </NavLink>
          ) : null}
          {showUsers || showRoles ? (
            <UserManagementMenu
              pathname={pathname}
              user={user}
              showUsers={showUsers}
              showRoles={showRoles}
            />
          ) : null}
        </nav>
        <div className="shrink-0 pt-6">
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}

function UserManagementMenu({
  pathname,
  user,
  showUsers,
  showRoles,
}: {
  pathname: string;
  user: SessionUser;
  showUsers: boolean;
  showRoles: boolean;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openOnPath, setOpenOnPath] = useState(pathname);
  const active =
    pathname.startsWith("/settings/users") ||
    pathname.startsWith("/settings/roles");

  if (pathname !== openOnPath) {
    setOpenOnPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-full px-4 text-sm font-medium ${navItemClass(
          active || open,
        )}`}
      >
        User management
        <Chevron open={open} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="grid gap-1 py-1 pl-3"
        >
          {showUsers ? (
            <MenuLink
              href={areaHref(
                user,
                USERS_VIEW,
                USERS_CREATE,
                "/settings/users",
                "/settings/users/new",
              )}
              active={pathname.startsWith("/settings/users")}
              onNavigate={() => {
                setOpen(false);
              }}
            >
              Users
            </MenuLink>
          ) : null}
          {showRoles ? (
            <MenuLink
              href={areaHref(
                user,
                ROLES_VIEW,
                ROLES_CREATE,
                "/settings/roles",
                "/settings/roles/new",
              )}
              active={pathname.startsWith("/settings/roles")}
              onNavigate={() => {
                setOpen(false);
              }}
            >
              Roles
            </MenuLink>
          ) : null}
        </div>
      ) : null}
    </div>
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
      className={`flex h-10 items-center rounded-full px-4 text-sm font-medium ${navItemClass(
        active,
      )}`}
    >
      {children}
    </Link>
  );
}

function MenuLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex h-10 items-center rounded-full px-4 text-sm font-medium ${navItemClass(
        active,
      )}`}
    >
      {children}
    </Link>
  );
}

function navItemClass(selected: boolean) {
  return selected
    ? "bg-accent text-accent-foreground"
    : "text-inverse-foreground";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-4 ${open ? "rotate-180" : ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6.5 8 10.5 12 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
