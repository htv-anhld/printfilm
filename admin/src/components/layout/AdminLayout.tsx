import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Bug,
  ChevronRight,
  Clapperboard,
  FileVideo,
  Film,
  Handshake,
  Image,
  KeyRound,
  Layers,
  Library,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Maximize2,
  Megaphone,
  PanelLeftClose,
  Receipt,
  Repeat,
  Scale,
  Search,
  Settings,
  Shapes,
  Store,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useMarketplaceEnabled } from "@/features/marketplace/api";
import { useI18n, type TFunction } from "@/i18n";
import { clearAuth, getCachedUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AdminNavigationSearch } from "./AdminNavigationSearch";
import { ChangePasswordDialog } from "@/components/admin/ChangePasswordDialog";

type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  matchPrefix?: boolean;
};

type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

const BUSINESS_GROUP = "layout.groups.business";

const navGroups: NavGroup[] = [
  {
    labelKey: "layout.groups.overview",
    items: [{ to: "/", labelKey: "layout.nav.dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    labelKey: BUSINESS_GROUP,
    items: [
      { to: "/users", labelKey: "layout.nav.users", icon: Users },
      { to: "/teams", labelKey: "layout.nav.teams", icon: UsersRound },
      { to: "/orders", labelKey: "layout.nav.orders", icon: Receipt },
      { to: "/adjustments", labelKey: "layout.nav.adjustments", icon: Scale },
      { to: "/finance", labelKey: "layout.nav.finance", icon: Wallet },
      { to: "/subscriptions", labelKey: "layout.nav.subscriptions", icon: Repeat },
      { to: "/partners", labelKey: "layout.nav.partners", icon: Handshake },
      { to: "/partner-submissions", labelKey: "layout.nav.partnerSubmissions", icon: Megaphone },
      { to: "/projects", labelKey: "layout.nav.projects", icon: Clapperboard },
      { to: "/works", labelKey: "layout.nav.works", icon: FileVideo },
    ],
  },
  {
    labelKey: "layout.groups.drama",
    items: [
      { to: "/drama-projects", labelKey: "layout.nav.dramaProjects", icon: Film, matchPrefix: true },
      { to: "/drama-assets", labelKey: "layout.nav.dramaAssets", icon: Image, matchPrefix: true },
      { to: "/drama-episodes", labelKey: "layout.nav.dramaEpisodes", icon: ListVideo, matchPrefix: true },
      { to: "/drama-fragments", labelKey: "layout.nav.dramaFragments", icon: Layers, matchPrefix: true },
    ],
  },
  {
    labelKey: "layout.groups.resources",
    items: [
      { to: "/templates", labelKey: "layout.nav.templates", icon: Shapes },
      { to: "/queues", labelKey: "layout.nav.queues", icon: Layers },
      { to: "/library", labelKey: "layout.nav.library", icon: Library },
    ],
  },
  {
    labelKey: "layout.groups.system",
    items: [
      { to: "/settings", labelKey: "layout.nav.settings", icon: Settings },
      { to: "/error-reports", labelKey: "layout.nav.errorReports", icon: Bug },
    ],
  },
];

/** 数字资产平台运营入口：仅在 marketplace 开启时追加到「业务」分组 */
const marketplaceNavItem: NavItem = { to: "/marketplace", labelKey: "layout.nav.marketplace", icon: Store };

const titleKeys: Record<string, string> = {
  "/": "layout.nav.dashboard",
  "/users": "layout.nav.users",
  "/teams": "layout.nav.teams",
  "/orders": "layout.nav.orders",
  "/adjustments": "layout.nav.adjustments",
  "/finance": "layout.nav.finance",
  "/projects": "layout.nav.projects",
  "/drama-projects": "layout.nav.dramaProjects",
  "/drama-assets": "layout.nav.dramaAssets",
  "/drama-episodes": "layout.nav.dramaEpisodes",
  "/drama-fragments": "layout.nav.dramaFragments",
  "/works": "layout.nav.works",
  "/marketplace": "layout.nav.marketplace",
  "/templates": "layout.nav.templates",
  "/settings": "layout.nav.settings",
  "/queues": "layout.nav.queues",
  "/error-reports": "layout.nav.errorReports",
  "/subscriptions": "layout.nav.subscriptions",
  "/library": "layout.nav.library",
  "/partners": "layout.nav.partners",
  "/partner-submissions": "layout.nav.partnerSubmissions",
};

// Resolve the top bar title for the current route
function resolveTitle(pathname: string, t: TFunction): string {
  if (pathname.startsWith("/teams/")) return t("layout.titles.teamDetail");
  if (pathname.startsWith("/drama-projects/")) return t("layout.titles.dramaProjectDetail");
  if (pathname.startsWith("/drama-assets/")) return t("layout.titles.assetDetail");
  if (pathname.startsWith("/drama-episodes/")) return t("layout.titles.episodeDetail");
  if (pathname.startsWith("/drama-fragments/")) return t("layout.titles.fragmentDetail");
  const key = titleKeys[pathname];
  return key ? t(key) : t("layout.admin");
}

/** Admin shell: collapsible sidebar on desktop, drawer on mobile, Ctrl+K navigation search. */
export function AdminLayout() {
  const { t } = useI18n();
  const marketplaceEnabled = useMarketplaceEnabled();
  const visibleNavGroups = useMemo(
    () =>
      navGroups.map((group) =>
        group.labelKey === BUSINESS_GROUP && marketplaceEnabled
          ? { ...group, items: [...group.items, marketplaceNavItem] }
          : group,
      ),
    [marketplaceEnabled],
  );
  // Navigation search expects already-translated labels
  const searchGroups = useMemo(
    () =>
      visibleNavGroups.map((group) => ({
        label: t(group.labelKey),
        items: group.items.map((item) => ({ to: item.to, label: t(item.labelKey), icon: item.icon })),
      })),
    [visibleNavGroups, t],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCachedUser();
  /*
   * collapsed: desktop sidebar collapsed; mobileOpen: mobile drawer open
   * searchOpen: Ctrl+K navigation search; passwordOpen: change-password dialog
   */
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 800px)").matches);
  const sidebarRef = useRef<HTMLElement>(null);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerOpen = isMobile && mobileOpen;
  const title = resolveTitle(location.pathname, t);
  const initial = (user?.nickname || user?.email || "A").slice(0, 1).toUpperCase();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    function onChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);
      if (!event.matches) setMobileOpen(false);
    }
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Mobile drawer: lock body scroll and trap focus inside the sidebar
  useLayoutEffect(() => {
    if (!mobileDrawerOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const navigationToggle = navigationToggleRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarCloseRef.current?.focus({ preventScroll: true });

    function focusableItems() {
      return Array.from(sidebar!.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    }
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusableItems();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !sidebar!.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar!.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    function keepFocusInside(event: FocusEvent) {
      if (event.target instanceof Node && !sidebar!.contains(event.target)) {
        sidebarCloseRef.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("keydown", trapFocus, true);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", trapFocus, true);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      if (sidebar.contains(document.activeElement) || document.activeElement === document.body) {
        const restoreTarget = previouslyFocused?.isConnected ? previouslyFocused : navigationToggle;
        restoreTarget?.focus({ preventScroll: true });
      }
    };
  }, [mobileDrawerOpen]);

  // Ctrl/Cmd+K opens navigation search; Escape closes the mobile drawer
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMobileOpen(false);
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Logout and return to login
  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  // Desktop: collapse sidebar; mobile: toggle drawer
  function toggleNavigation() {
    if (isMobile) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  const toggleLabel = isMobile
    ? (mobileOpen ? t("layout.closeNav") : t("layout.openNav"))
    : (collapsed ? t("layout.openNav") : t("layout.toggleSidebar"));

  return (
    <div className={cn("admin-app", collapsed && "is-collapsed", mobileDrawerOpen && "is-mobile-open")}>
      <a className="admin-skip-link" href="#admin-main-content">{t("layout.skipToContent")}</a>
      {mobileDrawerOpen && (
        <button type="button" className="admin-sidebar-scrim" tabIndex={-1} aria-label={t("layout.closeNav")} onClick={() => setMobileOpen(false)} />
      )}
      <aside
        ref={sidebarRef}
        className="admin-sidebar"
        id="admin-sidebar"
        aria-label={t("layout.adminNav")}
        role={mobileDrawerOpen ? "dialog" : undefined}
        aria-modal={mobileDrawerOpen ? true : undefined}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        inert={isMobile && !mobileOpen}
      >
        <div className="admin-brand">
          <div className="admin-brand-mark">PF</div>
          {!collapsed || mobileDrawerOpen ? (
            <div className="admin-brand-copy">
              <div className="admin-brand-name">PRINTFILM</div>
              <div className="admin-brand-sub">{t("layout.admin")}</div>
            </div>
          ) : null}
          <button ref={sidebarCloseRef} type="button" className="admin-icon-btn admin-sidebar-close" aria-label={t("layout.closeNav")} onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="admin-nav" aria-label={t("layout.mainNav")}>
          {visibleNavGroups.map((group) => (
            <div key={group.labelKey} className="admin-nav-group">
              {!collapsed || mobileDrawerOpen ? <div className="admin-nav-group-label">{t(group.labelKey)}</div> : null}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? !item.matchPrefix}
                  className={({ isActive }) =>
                    cn(
                      "admin-nav-item",
                      (isActive || (item.matchPrefix && location.pathname.startsWith(`${item.to}/`))) &&
                        "is-active",
                    )
                  }
                  title={t(item.labelKey)}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed || mobileDrawerOpen ? <span className="admin-nav-label">{t(item.labelKey)}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-user-card">
          <div className="admin-avatar">{initial}</div>
          {!collapsed || mobileDrawerOpen ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[#e8f0eb]" title={user?.email}>{user?.email}</div>
              <div className="text-xs text-[rgba(240,245,242,0.45)]">{t("layout.superAdmin")}</div>
            </div>
          ) : null}
          <button
            type="button"
            className="admin-icon-btn !text-[rgba(240,245,242,0.55)] hover:!text-[#e8f0eb]"
            onClick={handleLogout}
            title={t("layout.logout")}
            aria-label={t("layout.logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="admin-main" inert={mobileDrawerOpen}>
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button
              ref={navigationToggleRef}
              type="button"
              className="admin-icon-btn"
              onClick={toggleNavigation}
              aria-label={toggleLabel}
              aria-controls="admin-sidebar"
              aria-expanded={isMobile ? mobileOpen : !collapsed}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <div>
              <div className="admin-topbar-title">{title}</div>
              <div className="admin-topbar-crumb">
                PRINTFILM · {t("layout.crumb")}
                <ChevronRight className="mx-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                {title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="admin-command-trigger"
              aria-label={t("layout.search.trigger")}
              aria-keyshortcuts="Control+K Meta+K"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={15} />
              <span>{t("layout.search.placeholder")}</span>
              <kbd>Ctrl K</kbd>
            </button>
            <a
              className="admin-site-link"
              href={import.meta.env.DEV ? "http://127.0.0.1:5173" : "/"}
              target="_blank"
              rel="noreferrer"
            >
              {t("layout.userSite")}
              <ArrowUpRight size={14} />
            </a>
            <LanguageSwitcher className="mr-1" />
            <button type="button" className="admin-icon-btn" title={t("layout.notifications")} aria-label={t("layout.notifications")}>
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="admin-icon-btn admin-fullscreen"
              title={t("layout.fullscreen")}
              aria-label={t("layout.fullscreen")}
              onClick={() => {
                if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => undefined);
                else void document.exitFullscreen().catch(() => undefined);
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="admin-icon-btn"
              title={t("layout.changePassword")}
              aria-label={t("layout.changePassword")}
              onClick={() => setPasswordOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="admin-content" id="admin-main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <AdminNavigationSearch open={searchOpen} onOpenChange={setSearchOpen} groups={searchGroups} />
      {passwordOpen && <ChangePasswordDialog email={user?.email} onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
