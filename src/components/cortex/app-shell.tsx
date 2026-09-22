"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  MessagesSquare,
  Plus,
  Settings,
  Bot,
  ShieldCheck,
  BarChart3,
  GraduationCap,
} from "lucide-react";

import { api } from "@/lib/cortex-client";
import { useCortexStore, type View } from "@/components/cortex/store";
import { CortexMark } from "@/components/cortex/logo";
import { SignOutConfirm, useSignOut } from "@/components/cortex/bits";
import { faNum, initialsOf } from "@/components/cortex/format";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { DashboardView } from "@/components/cortex/views/dashboard-view";
import { AgentsView } from "@/components/cortex/views/agents-view";
import { AgentBuilderView, AgentEditView } from "@/components/cortex/views/agent-form";
import { AgentDetailView } from "@/components/cortex/views/agent-detail-view";
import { KnowledgeView } from "@/components/cortex/views/knowledge-view";
import { ConversationsView } from "@/components/cortex/views/conversations-view";
import { SettingsView } from "@/components/cortex/views/settings-view";
import { TelegramView } from "@/components/cortex/views/telegram-view";
import { AnalyticsView } from "@/components/cortex/views/analytics-view";
import { AdminView } from "@/components/cortex/views/admin-view";
import { LearnView } from "@/components/cortex/views/learn-view";

/* ---------------- provider status pill ---------------- */

function ProviderPill() {
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const { data, isLoading } = useQuery<Awaited<ReturnType<typeof api.getProvidersStatus>>>({
    queryKey: ["providers-status", activeWorkspaceId],
    queryFn: () => api.getProvidersStatus(activeWorkspaceId ?? undefined),
    enabled: !!activeWorkspaceId,
    staleTime: Infinity,
    retry: 1,
  });

  if (isLoading) {
    return <span aria-hidden="true" className="hidden h-8 w-28 animate-pulse rounded-full border bg-muted sm:inline-block" />;
  }
  if (!data) return null;

  const configured = data.llm.status === "configured";
  return (
    <span
      title={configured ? `${data.llm.provider}${data.llm.model ? ` · ${data.llm.model}` : ""}` : "سرویس‌دهنده هوش مصنوعی پیکربندی نشده است"}
      className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:inline-flex"
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full", configured ? "bg-emerald-400" : "bg-amber-400")} />
      {configured ? "متصل" : "هوش مصنوعی پیکربندی نشده"}
    </span>
  );
}

/* ---------------- workspace switcher ---------------- */

function WorkspaceSwitcher() {
  const workspaces = useCortexStore((s) => s.workspaces);
  const activeWorkspaceId = useCortexStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useCortexStore((s) => s.setActiveWorkspace);
  const setWorkspaces = useCortexStore((s) => s.setWorkspaces);
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["workspaces"], queryFn: api.getWorkspaces, staleTime: 60_000 });

  useEffect(() => {
    if (data?.workspaces) setWorkspaces(data.workspaces);
  }, [data, setWorkspaces]);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  function handleSwitch(workspaceId: string) {
    setActiveWorkspace(workspaceId);
    queryClient.invalidateQueries();
  }

  return (
    <div className="space-y-1.5">
      <p className="px-1 text-[11px] font-medium text-muted-foreground">فضای کاری</p>
      <Select value={active?.id ?? ""} onValueChange={handleSwitch} disabled={workspaces.length === 0}>
        <SelectTrigger className="h-11 w-full" aria-label="انتخاب فضای کاری">
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-primary">
              <Briefcase className="size-3.5" />
            </span>
            <SelectValue placeholder="فضای کاری">{active?.name ?? "فضای کاری"}</SelectValue>
          </span>
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => (
            <SelectItem key={workspace.id} value={workspace.id}>
              {workspace.name}
              {workspace._count ? ` · ${faNum(workspace._count.agents)} ایجنت` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ---------------- sign out ---------------- */

function SidebarUserCard() {
  const user = useCortexStore((s) => s.user);
  const signOutNow = useSignOut();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <Avatar className="size-9 border">
        <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
          {initialsOf(user?.name, "C")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "کاربر"}</p>
        <p dir="ltr" className="truncate text-left text-xs text-muted-foreground">
          {user?.email}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="خروج از حساب کاربری"
        title="خروج از حساب کاربری"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <LogOut />
      </Button>
      <SignOutConfirm open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={() => void signOutNow()} />
    </div>
  );
}

function MobileUserMenu() {
  const user = useCortexStore((s) => s.user);
  const setView = useCortexStore((s) => s.setView);
  const signOutNow = useSignOut();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="منوی کاربر" className="rounded-full">
            <Avatar className="size-8 border">
              <AvatarFallback className="bg-primary/15 text-[11px] font-bold text-primary">
                {initialsOf(user?.name, "C")}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="space-y-0.5">
            <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "کاربر"}</p>
            <p dir="ltr" className="truncate text-left text-xs font-normal text-muted-foreground">
              {user?.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setView("settings")}>
            <Settings />
            تنظیمات
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <LogOut />
            خروج از حساب
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutConfirm open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={() => void signOutNow()} />
    </>
  );
}

/* ---------------- navigation ---------------- */

interface NavItem {
  view: View;
  label: string;
  icon: typeof LayoutDashboard;
  matches: View[];
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "داشبورد", icon: LayoutDashboard, matches: ["dashboard"] },
  {
    view: "agents",
    label: "ایجنت‌ها",
    icon: Bot,
    matches: ["agents", "agent-new", "agent-detail", "agent-edit"],
  },
  { view: "knowledge", label: "دانش", icon: BookOpen, matches: ["knowledge"] },
  { view: "conversations", label: "گفتگوها", icon: MessagesSquare, matches: ["conversations"] },
  { view: "telegram", label: "تلگرام", icon: ShieldCheck, matches: ["telegram"] },
  { view: "analytics", label: "تحلیل", icon: BarChart3, matches: ["analytics"] },
  { view: "admin", label: "مدیریت", icon: ShieldCheck, matches: ["admin"] },
  { view: "learn", label: "آموزش", icon: GraduationCap, matches: ["learn"] },
];

const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  ["dashboard", "agents", "knowledge", "conversations"].includes(item.view)
);

function SidebarNav() {
  const view = useCortexStore((s) => s.view);
  const setView = useCortexStore((s) => s.setView);

  return (
    <nav aria-label="ناوبری اصلی" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.matches.includes(view);
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => setView(item.view)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
              />
            )}
            <item.icon aria-hidden="true" className="size-[18px]" />
            {item.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setView("settings")}
        aria-current={view === "settings" ? "page" : undefined}
        className={cn(
          "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
          view === "settings"
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <Settings aria-hidden="true" className="size-[18px]" />
        تنظیمات
      </button>
    </nav>
  );
}

/* ---------------- mobile bottom nav ---------------- */

function BottomNav({ onMore }: { onMore: () => void }) {
  const view = useCortexStore((s) => s.view);
  const setView = useCortexStore((s) => s.setView);

  const moreActive = !MOBILE_NAV_ITEMS.some((item) => item.matches.includes(view));

  return (
    <nav
      aria-label="ناوبری موبایل"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-popover/95 backdrop-blur supports-[backdrop-filter]:bg-popover/85 lg:hidden"
    >
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = item.matches.includes(view);
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => setView(item.view)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon aria-hidden="true" className="size-5" />
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-label="بیشتر"
          aria-current={moreActive ? "page" : undefined}
          className={cn(
            "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition-colors",
            moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MoreHorizontal aria-hidden="true" className="size-5" />
          بیشتر
        </button>
      </div>
    </nav>
  );
}

/* ---------------- page title ---------------- */

function usePageTitle(): string {
  const view = useCortexStore((s) => s.view);
  const activeAgentId = useCortexStore((s) => s.activeAgentId);

  const { data: agentData } = useQuery({
    queryKey: ["agent", activeAgentId],
    queryFn: () => api.getAgent(activeAgentId as string),
    enabled: (view === "agent-detail" || view === "agent-edit") && !!activeAgentId,
    staleTime: 30_000,
    select: (response) => response.agent.name,
  });

  switch (view) {
    case "dashboard":
      return "داشبورد";
    case "agents":
      return "ایجنت‌ها";
    case "agent-new":
      return "ایجاد ایجنت جدید";
    case "agent-detail":
      return agentData ?? "جزئیات ایجنت";
    case "agent-edit":
      return "ویرایش ایجنت";
    case "knowledge":
      return "دانش";
    case "conversations":
      return "گفتگوها";
    case "settings":
      return "تنظیمات";
    case "telegram":
      return "تلگرام";
    case "analytics":
      return "تحلیل و بینش";
    case "admin":
      return "مدیریت";
    case "learn":
      return "آموزش";
    default:
      return "Cortex AI";
  }
}

/* ---------------- view routing ---------------- */

function renderView(view: View) {
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "agents":
      return <AgentsView />;
    case "agent-new":
      return <AgentBuilderView />;
    case "agent-detail":
      return <AgentDetailView />;
    case "agent-edit":
      return <AgentEditView />;
    case "knowledge":
      return <KnowledgeView />;
    case "conversations":
      return <ConversationsView />;
    case "settings":
      return <SettingsView />;
    case "telegram":
      return <TelegramView />;
    case "analytics":
      return <AnalyticsView />;
    case "admin":
      return <AdminView />;
    case "learn":
      return <LearnView />;
    default:
      return <DashboardView />;
  }
}

/* ---------------- shell ---------------- */

export function AppShell() {
  const view = useCortexStore((s) => s.view);
  const activeAgentId = useCortexStore((s) => s.activeAgentId);
  const setView = useCortexStore((s) => s.setView);
  const activeWorkspaceName = useCortexStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name);

  const [moreOpen, setMoreOpen] = useState(false);
  const title = usePageTitle();

  const viewKey = view.startsWith("agent") && activeAgentId ? `${view}-${activeAgentId}` : view;
  const showCta = view === "dashboard" || view === "agents";

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar — first in DOM = right side in RTL */}
      <aside className="cortex-sidebar hidden w-[268px] shrink-0 flex-col gap-5 border-l p-4 lg:flex">
        <div className="px-1 pt-1">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <CortexMark size={34} />
            Cortex <span className="text-primary">AI</span>
          </span>

          <div aria-hidden="true" className="cortex-status-line mt-4 h-px w-full" />
        </div>

        <WorkspaceSwitcher />

        <div className="flex-1">
          <SidebarNav />
        </div>

        <SidebarUserCard />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="cortex-topbar relative flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <CortexMark size={30} />
            <span className="truncate text-sm font-semibold text-foreground">
              {activeWorkspaceName ?? "Cortex AI"}
            </span>
          </div>

          <h1 className="hidden truncate text-lg font-bold text-foreground lg:block">{title}</h1>

          <div className="flex items-center gap-2 sm:gap-3">
            {showCta && (
              <Button size="sm" className="hidden sm:inline-flex" onClick={() => setView("agent-new")}>
                <Plus />
                ایجاد ایجنت
              </Button>
            )}
            <ProviderPill />
            <div className="lg:hidden">
              <MobileUserMenu />
            </div>
          </div>
        </header>

        <main className="cortex-scroll flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-8 lg:pb-10 lg:pt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={viewKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {renderView(view)}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <BottomNav onMore={() => setMoreOpen(true)} />
      </div>

      {/* Mobile «بیشتر» sheet */}
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}

function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const setView = useCortexStore((s) => s.setView);
  const signOutNow = useSignOut();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl px-4 pb-8 pt-2">
          <SheetHeader className="p-2 text-right">
            <SheetTitle className="text-base">بیشتر</SheetTitle>
            <SheetDescription>دسترسی به تنظیمات، فضای کاری و حساب کاربری</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-2">
            <WorkspaceSwitcher />
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="h-12 w-full justify-start gap-3"
                onClick={() => {
                  onOpenChange(false);
                  setView("settings");
                }}
              >
                <Settings aria-hidden="true" className="size-4" />
                تنظیمات
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full justify-start gap-3 text-destructive hover:text-destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <LogOut aria-hidden="true" className="size-4" />
                خروج از حساب کاربری
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <SignOutConfirm
        open={confirmOpen}
        onOpenChange={(next) => {
          setConfirmOpen(next);
          if (!next) onOpenChange(false);
        }}
        onConfirm={() => void signOutNow()}
      />
    </>
  );
}
