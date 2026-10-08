"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { useMobileSearch } from "@/components/mobile-search";
import { SignOutButton } from "@/components/sign-out-button";
import { useSession } from "@/components/session-provider";
import {
  ASSET_TYPES_VIEW,
  BCIS_REF_AREA_PERMISSIONS,
  BCIS_REFS_CREATE,
  BCIS_REFS_VIEW,
  BCIS_SUB_REF_AREA_PERMISSIONS,
  BCIS_SUB_REFS_CREATE,
  BCIS_SUB_REFS_VIEW,
  CLIENTS_VIEW,
  hasAnyPermission,
  hasPermission,
  MAINTENANCE_TYPES_VIEW,
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openOnPath, setOpenOnPath] = useState(pathname);
  const mobileSearch = useMobileSearch();
  const showClients = hasPermission(user, CLIENTS_VIEW);
  const showAssetTypes = hasPermission(user, ASSET_TYPES_VIEW);
  const showBcisRefs = hasAnyPermission(user, BCIS_REF_AREA_PERMISSIONS);
  const showBcisSubRefs = hasAnyPermission(user, BCIS_SUB_REF_AREA_PERMISSIONS);
  const showMaintenanceTypes = hasPermission(user, MAINTENANCE_TYPES_VIEW);
  const showUsers = hasAnyPermission(user, USER_AREA_PERMISSIONS);
  const showRoles = hasAnyPermission(user, ROLE_AREA_PERMISSIONS);

  if (pathname !== openOnPath) {
    setOpenOnPath(pathname);
    setMobileOpen(false);
  }

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-40 flex h-16 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => {
            mobileSearch.close();
            setMobileOpen(true);
          }}
          className="flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <MenuIcon />
        </button>
        <Logo />
        <button
          type="button"
          aria-label={mobileSearch.expanded ? "Close search" : "Search"}
          aria-expanded={mobileSearch.expanded}
          aria-controls="workspace-search"
          onClick={() => {
            setMobileOpen(false);
            mobileSearch.toggle();
          }}
          className={`ml-auto flex size-10 items-center justify-center rounded-lg hover:bg-gray-100 ${
            mobileSearch.expanded ? "bg-gray-100 text-gray-800" : "text-gray-500"
          }`}
        >
          <SearchIcon />
        </button>
      </header>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={() => {
            setMobileOpen(false);
          }}
        />
      ) : null}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-[290px] flex-col border-r border-gray-200 bg-white transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            className="flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden"
            onClick={() => {
              setMobileOpen(false);
            }}
          >
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4">
          {showClients ? (
            <NavLink href="/clients" active={pathname.startsWith("/clients")} icon={<ClientsIcon />}>
              Clients
            </NavLink>
          ) : null}
          {showClients ? (
            <NavLink href="/sites" active={pathname.startsWith("/sites")} icon={<SitesIcon />}>
              Sites
            </NavLink>
          ) : null}
          <NavLink href="/audits" active={pathname.startsWith("/audits")} icon={<AuditsIcon />}>
            Audits
          </NavLink>
          <NavLink
            href="/work-orders"
            active={pathname.startsWith("/work-orders")}
            icon={<WorkOrdersIcon />}
          >
            Work orders
          </NavLink>
          {showAssetTypes ||
          showMaintenanceTypes ||
          showBcisRefs ||
          showBcisSubRefs ||
          showUsers ||
          showRoles ? (
            <SettingsMenu
              pathname={pathname}
              user={user}
              showAssetTypes={showAssetTypes}
              showMaintenanceTypes={showMaintenanceTypes}
              showBcisRefs={showBcisRefs}
              showBcisSubRefs={showBcisSubRefs}
              showUsers={showUsers}
              showRoles={showRoles}
            />
          ) : null}
        </nav>
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="truncate text-sm font-medium text-gray-800">
            {user.name || user.email}
          </p>
          {user.name ? (
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          ) : null}
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}

function SettingsMenu({
  pathname,
  user,
  showAssetTypes,
  showMaintenanceTypes,
  showBcisRefs,
  showBcisSubRefs,
  showUsers,
  showRoles,
}: {
  pathname: string;
  user: SessionUser;
  showAssetTypes: boolean;
  showMaintenanceTypes: boolean;
  showBcisRefs: boolean;
  showBcisSubRefs: boolean;
  showUsers: boolean;
  showRoles: boolean;
}) {
  const menuId = useId();
  const active =
    pathname.startsWith("/asset-types") ||
    pathname.startsWith("/maintenance-types") ||
    pathname.startsWith("/bcis-refs") ||
    pathname.startsWith("/bcis-sub-refs") ||
    pathname.startsWith("/settings");
  const [open, setOpen] = useState(active);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`menu-item ${active || open ? "menu-item-active" : "menu-item-inactive"}`}
      >
        <span className={active || open ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
          <SettingsIcon />
        </span>
        <span className="flex-1 text-left">Settings</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={menuId} className="mt-1 grid gap-1 pl-9">
          {showAssetTypes ? (
            <NavLink
              href="/asset-types"
              active={pathname.startsWith("/asset-types")}
              icon={<AssetTypesIcon />}
            >
              Asset types
            </NavLink>
          ) : null}
          {showMaintenanceTypes ? (
            <NavLink
              href="/maintenance-types"
              active={pathname.startsWith("/maintenance-types")}
              icon={<MaintenanceTypesIcon />}
            >
              Maintenance types
            </NavLink>
          ) : null}
          {showBcisRefs || showBcisSubRefs ? (
            <ReferencesMenu
              pathname={pathname}
              user={user}
              showBcisRefs={showBcisRefs}
              showBcisSubRefs={showBcisSubRefs}
            />
          ) : null}
          {showUsers || showRoles ? (
            <UserManagementMenu
              pathname={pathname}
              user={user}
              showUsers={showUsers}
              showRoles={showRoles}
            />
          ) : null}
        </div>
      ) : null}
    </div>
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
  const active =
    pathname.startsWith("/settings/users") || pathname.startsWith("/settings/roles");
  const [open, setOpen] = useState(active);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`menu-item ${active || open ? "menu-item-active" : "menu-item-inactive"}`}
      >
        <span className={active || open ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
          <UsersIcon />
        </span>
        <span className="flex-1 text-left">User management</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={menuId} className="mt-1 grid gap-1 pl-9">
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
            >
              Roles
            </MenuLink>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReferencesMenu({
  pathname,
  user,
  showBcisRefs,
  showBcisSubRefs,
}: {
  pathname: string;
  user: SessionUser;
  showBcisRefs: boolean;
  showBcisSubRefs: boolean;
}) {
  const menuId = useId();
  const active =
    pathname.startsWith("/bcis-refs") || pathname.startsWith("/bcis-sub-refs");
  const [open, setOpen] = useState(active);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`menu-item ${active || open ? "menu-item-active" : "menu-item-inactive"}`}
      >
        <span className={active || open ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
          <ReferencesIcon />
        </span>
        <span className="flex-1 text-left">References</span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={menuId} className="mt-1 grid gap-1 pl-9">
          {showBcisRefs ? (
            <MenuLink
              href={areaHref(
                user,
                BCIS_REFS_VIEW,
                BCIS_REFS_CREATE,
                "/bcis-refs",
                "/bcis-refs/new",
              )}
              active={pathname.startsWith("/bcis-refs")}
            >
              BCIS references
            </MenuLink>
          ) : null}
          {showBcisSubRefs ? (
            <MenuLink
              href={areaHref(
                user,
                BCIS_SUB_REFS_VIEW,
                BCIS_SUB_REFS_CREATE,
                "/bcis-sub-refs",
                "/bcis-sub-refs/new",
              )}
              active={pathname.startsWith("/bcis-sub-refs")}
            >
              BCIS sub references
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
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`menu-item ${active ? "menu-item-active" : "menu-item-inactive"}`}
    >
      <span className={active ? "menu-item-icon-active" : "menu-item-icon-inactive"}>
        {icon}
      </span>
      {children}
    </Link>
  );
}

function MenuLink({
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
      className={`menu-dropdown-item ${
        active ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"
      }`}
    >
      {children}
    </Link>
  );
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M3 5.5h14M3 10h14M3 14.5h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m12.5 12.5 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M3.5 7.5 10 4l6.5 3.5v6L10 17l-6.5-3.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReferencesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M6.2 3.5h8.2A1.6 1.6 0 0 1 16 5.1v11.4L10 14.2 4 16.5V5.1A1.6 1.6 0 0 1 5.6 3.5h.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7.5h5M7.5 10.5h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MaintenanceTypesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M11.6 4.2 8.4 7.4l-3.1 1 .8 2.2 2.2.8 1 3.1 3.2-3.2a3.1 3.1 0 0 0 3.6-4.4l-2.1 2.1-1.6-.5-.5-1.6 2.1-2.1a3.1 3.1 0 0 0-4.4 3.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m5.2 13.4-1.6 1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssetTypesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="3.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3.5" y="11.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="11.5" y="11.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.8v1.8M10 15.4v1.8M2.8 10h1.8M15.4 10h1.8M4.8 4.8l1.3 1.3M13.9 13.9l1.3 1.3M15.2 4.8l-1.3 1.3M6.1 13.9l-1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SitesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M10 17s5-4.2 5-8a5 5 0 1 0-10 0c0 3.8 5 8 5 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="9" r="1.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function AuditsIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <rect x="5" y="3.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 3.2h4a.8.8 0 0 1 .8.8v1.2H7.2V4a.8.8 0 0 1 .8-.8ZM7.5 9.5h5M7.5 12.5h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WorkOrdersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <rect x="4.5" y="3.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.5 10.2 9.1 11.8 12.6 8.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.8 15.2c.6-2 2-3 3.7-3s3.1 1 3.7 3M12.2 6.2a2 2 0 0 1 0 3.6M13.2 12.2c1.2.2 2.1 1 2.6 2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
