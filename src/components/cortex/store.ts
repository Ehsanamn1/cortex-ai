"use client";

import { create } from "zustand";
import type { UserDto, WorkspaceDto } from "@/lib/cortex-client";

export type View =
  | "dashboard"
  | "agents"
  | "agent-new"
  | "agent-detail"
  | "agent-edit"
  | "knowledge"
  | "conversations"
  | "settings"
  | "telegram"
  | "analytics"
  | "admin"
  | "learn";

export type AgentTab = "overview" | "knowledge" | "playground" | "api" | "settings";

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
      view: "dashboard",
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

  setView: (view) => set({ view }),

  openAgent: (agentId, tab = "overview") =>
    set({ view: "agent-detail", activeAgentId: agentId, agentTab: tab, activeConversationId: null }),

  openConversation: (agentId, conversationId) =>
    set({
      view: "agent-detail",
      activeAgentId: agentId,
      agentTab: "playground",
      activeConversationId: conversationId,
    }),

  setAgentTab: (tab) => set({ agentTab: tab }),

  setActiveConversationId: (conversationId) => set({ activeConversationId: conversationId }),

  signOut: () => set({ ...initialState }),
}));
