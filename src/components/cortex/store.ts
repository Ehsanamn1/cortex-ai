"use client";

import { create } from "zustand";
import type { UserDto, WorkspaceDto } from "@/lib/cortex-client";

export type View =
  | "dashboard"
  | "workflows"
  | "agents"
  | "agent-new"
  | "agent-detail"
  | "agent-edit"
  | "knowledge"
  | "conversations"
  | "settings"
  | "telegram"
  | "analytics"
  | "billing"
  | "admin"
  | "learn";

export type AgentTab = "overview" | "knowledge" | "ai" | "tools" | "telegram" | "playground" | "api" | "analytics" | "settings";

interface CortexState {
  user: UserDto | null;
  workspaces: WorkspaceDto[];
  activeWorkspaceId: string | null;
  view: View;
  activeAgentId: string | null;
  activeConversationId: string | null;
  agentTab: AgentTab;
  hydrate: (user: UserDto, workspaces: WorkspaceDto[]) => void;
  setWorkspaces: (workspaces: WorkspaceDto[]) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  setView: (view: View) => void;
  openAgent: (agentId: string, tab?: AgentTab) => void;
  openConversation: (agentId: string, conversationId: string) => void;
  setAgentTab: (tab: AgentTab) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  syncFromUrl: () => void;
  signOut: () => void;
}

const initialState = {
  user: null,
  workspaces: [] as WorkspaceDto[],
  activeWorkspaceId: null as string | null,
  view: "dashboard" as View,
  activeAgentId: null as string | null,
  activeConversationId: null as string | null,
  agentTab: "overview" as AgentTab,
};

export const useCortexStore = create<CortexState>()((set) => ({
  ...initialState,

  hydrate: (user, workspaces) =>
    set({
      user,
      workspaces,
      activeWorkspaceId: workspaces[0]?.id ?? null,
      view: "billing",
      activeAgentId: null,
      activeConversationId: null,
      agentTab: "overview",
    }),

  setWorkspaces: (workspaces) =>
    set((state) => ({
      workspaces,
      activeWorkspaceId: workspaces.some((w) => w.id === state.activeWorkspaceId)
        ? state.activeWorkspaceId
        : (workspaces[0]?.id ?? null),
    })),

  setActiveWorkspace: (workspaceId) => set({ activeWorkspaceId: workspaceId }),

  setView: (view) => {
    set({ view });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      if (view === "agent-new") {
        url.searchParams.delete("agent");
        url.searchParams.delete("tab");
        url.searchParams.delete("conversation");
      } else if (!view.startsWith("agent")) {
        url.searchParams.delete("agent");
        url.searchParams.delete("tab");
        url.searchParams.delete("conversation");
      } else if (view !== "agent-detail") {
        url.searchParams.delete("tab");
        url.searchParams.delete("conversation");
      }
      window.history.replaceState({}, "", url);
    }
  },

  openAgent: (agentId, tab = "overview") => {
    set({ view: "agent-detail", activeAgentId: agentId, agentTab: tab, activeConversationId: null });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "agent-detail");
      url.searchParams.set("agent", agentId);
      url.searchParams.set("tab", tab);
      url.searchParams.delete("conversation");
      window.history.replaceState({}, "", url);
    }
  },

  openConversation: (agentId, conversationId) => {
    set({
      view: "agent-detail",
      activeAgentId: agentId,
      agentTab: "playground",
      activeConversationId: conversationId,
    });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "agent-detail");
      url.searchParams.set("agent", agentId);
      url.searchParams.set("tab", "playground");
      url.searchParams.set("conversation", conversationId);
      window.history.replaceState({}, "", url);
    }
  },

  setAgentTab: (tab) => {
    set({ agentTab });
    if (typeof window !== "undefined") {
      const state = useCortexStore.getState();
      const url = new URL(window.location.href);
      url.searchParams.set("view", "agent-detail");
      if (state.activeAgentId) url.searchParams.set("agent", state.activeAgentId);
      url.searchParams.set("tab", tab);
      if (tab !== "playground") url.searchParams.delete("conversation");
      window.history.replaceState({}, "", url);
    }
  },

  setActiveConversationId: (conversationId) => set({ activeConversationId: conversationId }),

  syncFromUrl: () => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    const validViews: View[] = [
      "dashboard", "workflows", "agents", "agent-new", "agent-detail", "agent-edit",
      "knowledge", "conversations", "settings", "telegram", "analytics", "billing", "admin", "learn",
    ];
    if (!rawView || !validViews.includes(rawView as View)) return;

    const view = rawView as View;
    if (view === "agent-detail" || view === "agent-edit") {
      const agentId = params.get("agent");
      if (!agentId) return;
      const rawTab = params.get("tab") as AgentTab | null;
      const validTabs: AgentTab[] = ["overview", "knowledge", "ai", "tools", "telegram", "playground", "api", "analytics", "settings"];
      const agentTab = rawTab && validTabs.includes(rawTab) ? rawTab : "overview";
      set({
        view,
        activeAgentId: agentId,
        agentTab,
        activeConversationId: agentTab === "playground" ? params.get("conversation") : null,
      });
      return;
    }

    set({
      view,
      activeAgentId: null,
      activeConversationId: null,
      agentTab: "overview",
    });
  },

  signOut: () => set({ ...initialState }),
}));
