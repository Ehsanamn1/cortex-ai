/**
 * Cortex AI — typed API client (Phase 1 locked contract).
 * Same-origin fetch wrapper with JSON parsing and Persian error surfacing.
 * The backend returns errors as `{ "error": "<Persian message>" }`.
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/* ---------------- DTOs (field names exactly as documented in worklog.md) ---------------- */

export interface UserDto {
  id: string;
  name: string | null;
  email: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  role: string;
  createdAt?: string;
  _count?: { agents: number };
}

export type AgentLanguage = "fa" | "en";
export type AgentTone = "professional" | "friendly" | "concise" | "formal" | "custom";

export interface AgentDto {
  id: string;
  name: string;
  orgName: string | null;
  description: string | null;
  language: AgentLanguage;
  tone: AgentTone;
  customTone: string | null;
  instructions: string | null;
  persona: string | null;
  systemPrompt: string | null;
  temperature: number;
  topP: number;
  maxTokens: number;
  memoryEnabled: boolean;
  citationsEnabled: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { knowledgeSources: number; conversations: number };
}

export interface AgentDetailDto extends AgentDto {
  _count: { knowledgeSources: number; conversations: number; messages: number };
  knowledgeReady: boolean;
}

export interface CreateAgentInput {
  name: string;
  orgName?: string;
  description?: string;
  language: AgentLanguage;
  tone: AgentTone;
  customTone?: string;
  instructions?: string;
  persona?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  memoryEnabled?: boolean;
  citationsEnabled?: boolean;
  workspaceId?: string;
}

export type UpdateAgentInput = Partial<CreateAgentInput>;

export type KnowledgeSourceType = "file" | "url";
export type KnowledgeSourceStatus = "pending" | "processing" | "ready" | "failed";

export interface KnowledgeDocumentDto {
  id: string;
  name: string;
  status: string;
  chunkCount: number;
  url: string | null;
}

export interface KnowledgeSourceDto {
  id: string;
  name: string;
  type: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  documents: KnowledgeDocumentDto[];
}

export interface ConversationListItemDto {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationDto extends ConversationListItemDto {
  agentId: string;
}

export interface SourceRef {
  index: number;
  documentName: string;
  page?: number | null;
  sourceUrl?: string | null;
}

export interface RetrievalRef {
  index: number;
  score: number;
  documentName: string;
  page?: number | null;
  sourceUrl?: string | null;
  snippet?: string | null;
}

export interface MessageMetadata {
  sources?: SourceRef[];
  retrieval?: RetrievalRef[];
  provider?: string;
  model?: string;
  latencyMs?: number;
}

export interface MessageDto {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  metadata: MessageMetadata | null;
}

export interface ConversationDetailDto {
  conversation: ConversationDto;
  agent: AgentDto;
  messages: MessageDto[];
}

export interface ChatResponse {
  userMessage: MessageDto;
  assistantMessage: MessageDto;
}

export interface DashboardStatsDto {
  telegramBots?: number;
  totalUsageEvents?: number;
  totalTokens?: number;
  estimatedCostMicros?: number;
  todayMessages?: number;
  todayTokens?: number;
  agents: number;
  activeAgents: number;
  knowledgeSources: number;
  knowledgeReady: number;
  conversations: number;
  messages: number;
}

export interface DashboardDto {
  stats: DashboardStatsDto;
  activity?: Array<{ id:string; action:string; entityType:string; createdAt:string }>;
  recentAgents: Array<{ id: string; name: string; updatedAt: string }>;
  recentConversations: Array<{
    id: string;
    title: string;
    agentId: string;
    agentName: string;
    updatedAt: string;
  }>;
}

export interface ProvidersStatusDto {
  llm: { provider: string; status: "configured" | "not_configured"; model: string | null };
  embeddings: {
    provider: string;
    status: "configured" | "not_configured";
    model: string | null;
    mode: "neural" | "lexical" | null;
  };
  vectorStore: { provider: "local" | "qdrant"; status: "ready" | "not_configured" };
}

export interface ProviderHealthOkDto {
  ok: true;
  llm: { provider: string; model: string; latencyMs: number; sample: string };
}


export interface ProviderConfigDto { id:string; providerName:string; baseUrl:string; model:string; authMode:string; enabled:boolean; hasApiKey:boolean }
export interface TelegramBotDto { id:string; name:string; agentId:string; agentName:string; username:string|null; status:string; mode:string; lastError:string|null; lastSeenAt:string|null; createdAt:string; updatedAt:string; allowlistCount:number; usersCount:number }
export interface TelegramAllowlistDto { id:string; botId:string; phoneNumber:string; displayName:string|null; notes:string|null; status:string; createdAt:string; updatedAt:string }
export interface TelegramUserDto { id:string; botId:string; telegramUserId:string; phoneNumber:string|null; username:string|null; firstName:string|null; lastName:string|null; status:string; dailyMessageLimit:number; monthlyMessageLimit:number; dailyTokenLimit:number; monthlyTokenLimit:number; lastSeenAt:string|null; createdAt:string; updatedAt:string; usage?:{events:number;tokens:number;inputTokens:number;outputTokens:number}; bot?:{name:string} }
export interface AnalyticsDto { users:number; bots:number; usage:{events:number;tokens:number;inputTokens:number;outputTokens:number;estimatedCostMicros:number}; trend:Array<{date:string;messages:number;tokens:number}>; topQuestions:Array<{question:string;count:number}>; unanswered:number; unansweredQuestions:Array<{question:string;count:number}> }

export interface SessionDto {
  user: UserDto;
  workspaces: WorkspaceDto[];
}

export interface SiteConfigDto { settings: Record<string, string> }

/* ---------------- core fetch machinery ---------------- */

const GENERIC_ERROR = "خطای غیرمنتظره‌ای رخ داد؛ لطفاً دوباره تلاش کنید.";
const NETWORK_ERROR = "ارتباط با سرور برقرار نشد؛ لطفاً اتصال خود را بررسی کنید.";

function extractErrorMessage(parsed: unknown): string | null {
  if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
    const error = (parsed as { error: unknown }).error;
    if (typeof error === "string" && error.length > 0) return error;
  }
  return null;
}

async function parseBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(parsed) ?? GENERIC_ERROR, response.status);
  }

  return parsed as T;
}

function jsonRequest<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/* ---------------- API surface ---------------- */

export const api = {
  getSiteConfig(): Promise<SiteConfigDto> { return request("/api/site-config"); },
  /* AUTH */

  signup(input: { name?: string; email: string; password: string }): Promise<SessionDto> {
    return jsonRequest("/api/auth/signup", "POST", input);
  },

  login(input: { email: string; password: string }): Promise<SessionDto> {
    return jsonRequest("/api/auth/login", "POST", input);
  },

  logout(): Promise<{ ok: boolean }> {
    return jsonRequest("/api/auth/logout", "POST");
  },

  /** Session check: 200 → session, 401 → null, anything else throws. */
  async checkSession(): Promise<SessionDto | null> {
    let response: Response;
    try {
      response = await fetch("/api/auth/me", { credentials: "same-origin" });
    } catch {
      throw new ApiError(NETWORK_ERROR, 0);
    }
    if (response.status === 401) return null;
    const parsed = await parseBody(response);
    if (!response.ok) {
      throw new ApiError(extractErrorMessage(parsed) ?? GENERIC_ERROR, response.status);
    }
    return parsed as SessionDto;
  },

  /* WORKSPACES */

  getWorkspaces(): Promise<{ workspaces: WorkspaceDto[] }> {
    return request("/api/workspaces");
  },

  createWorkspace(name: string): Promise<{ workspace: WorkspaceDto }> {
    return jsonRequest("/api/workspaces", "POST", { name });
  },

  /* AGENTS */

  getAgents(workspaceId?: string): Promise<{ agents: AgentDto[] }> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return request(`/api/agents${query}`);
  },

  createAgent(input: CreateAgentInput): Promise<{ agent: AgentDto }> {
    return jsonRequest("/api/agents", "POST", input);
  },

  getAgent(agentId: string): Promise<{ agent: AgentDetailDto; knowledgeReady: boolean }> {
    return request(`/api/agents/${encodeURIComponent(agentId)}`);
  },

  updateAgent(agentId: string, input: UpdateAgentInput): Promise<{ agent: AgentDto }> {
    return jsonRequest(`/api/agents/${encodeURIComponent(agentId)}`, "PATCH", input);
  },

  deleteAgent(agentId: string): Promise<{ ok: boolean }> {
    return jsonRequest(`/api/agents/${encodeURIComponent(agentId)}`, "DELETE");
  },

  /* KNOWLEDGE */

  getKnowledge(agentId: string): Promise<{ sources: KnowledgeSourceDto[] }> {
    return request(`/api/agents/${encodeURIComponent(agentId)}/knowledge`);
  },

  createKnowledgeUpload(agentId: string, input: { name: string; size: number; mimeType?: string }): Promise<{ source: KnowledgeSourceDto; upload: { url: string; key: string; expiresIn: number; maxSizeMb: number } }> {
    return jsonRequest(`/api/agents/${encodeURIComponent(agentId)}/knowledge/upload-url`, "POST", input);
  },

  completeKnowledgeUpload(agentId: string, input: { sourceId: string; key: string; size?: number }): Promise<{ source: KnowledgeSourceDto }> {
    return jsonRequest(`/api/agents/${encodeURIComponent(agentId)}/knowledge/complete`, "POST", input);
  },

  uploadKnowledgeFile(agentId: string, file: File): Promise<{ source: KnowledgeSourceDto }> {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/api/agents/${encodeURIComponent(agentId)}/knowledge`, {
      method: "POST",
      body: formData,
    });
  },

  addKnowledgeUrl(agentId: string, url: string): Promise<{ source: KnowledgeSourceDto }> {
    return jsonRequest(`/api/agents/${encodeURIComponent(agentId)}/knowledge`, "POST", { url });
  },

  deleteKnowledgeSource(sourceId: string): Promise<{ ok: boolean }> {
    return jsonRequest(`/api/knowledge/${encodeURIComponent(sourceId)}`, "DELETE");
  },

  retryKnowledgeSource(sourceId: string): Promise<{ source: KnowledgeSourceDto }> {
    return jsonRequest(`/api/knowledge/${encodeURIComponent(sourceId)}/retry`, "POST");
  },

  /* CONVERSATIONS */

  getConversations(agentId: string): Promise<{ conversations: ConversationListItemDto[] }> {
    return request(`/api/agents/${encodeURIComponent(agentId)}/conversations`);
  },

  createConversation(agentId: string): Promise<{ conversation: ConversationDto }> {
    return jsonRequest(`/api/agents/${encodeURIComponent(agentId)}/conversations`, "POST");
  },

  getConversation(conversationId: string): Promise<ConversationDetailDto> {
    return request(`/api/conversations/${encodeURIComponent(conversationId)}`);
  },

  deleteConversation(conversationId: string): Promise<{ ok: boolean }> {
    return jsonRequest(`/api/conversations/${encodeURIComponent(conversationId)}`, "DELETE");
  },

  chat(conversationId: string, content: string): Promise<ChatResponse> {
    return jsonRequest(`/api/conversations/${encodeURIComponent(conversationId)}/chat`, "POST", { content });
  },

  /* DASHBOARD */

  getDashboard(workspaceId?: string): Promise<DashboardDto> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return request(`/api/dashboard${query}`);
  },

  /* PROVIDERS */

  getProvidersStatus(workspaceId?: string): Promise<ProvidersStatusDto> {
    return request(`/api/providers/status${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`);
  },
  getProviderConfig(workspaceId?: string): Promise<{config:ProviderConfigDto|null;status:ProvidersStatusDto["llm"]}> {
    return request(`/api/settings/provider${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`);
  },
  saveProviderConfig(input:{workspaceId?:string;providerName:string;baseUrl:string;model:string;authMode:string;apiKey?:string;enabled?:boolean}): Promise<{config:ProviderConfigDto;status:ProvidersStatusDto["llm"]}> {
    return jsonRequest('/api/settings/provider','PUT',input);
  },
  getLimits(workspaceId?:string){ return request<{policy:{workspaceId:string;dailyMessageLimit:number;monthlyMessageLimit:number;dailyTokenLimit:number;monthlyTokenLimit:number}}>(`/api/settings/limits${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:""}`); },
  saveLimits(input:{workspaceId?:string;dailyMessageLimit:number;monthlyMessageLimit:number;dailyTokenLimit:number;monthlyTokenLimit:number}){ return jsonRequest<{policy:any}>('/api/settings/limits','PUT',input); },
  reconnectTelegramBot(id:string){ return jsonRequest<{bot:TelegramBotDto}>(`/api/telegram/bots/${encodeURIComponent(id)}/connect`,'POST'); },
  getTelegramBots(workspaceId?:string):Promise<{bots:TelegramBotDto[]}>{ return request(`/api/telegram/bots${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:''}`); },
  createTelegramBot(input:{workspaceId?:string;agentId:string;name:string;token:string;mode:'webhook'|'polling'}){ return jsonRequest<{bot:TelegramBotDto}>('/api/telegram/bots','POST',input); },
  updateTelegramBot(id:string,input:Record<string,unknown>){ return jsonRequest<{bot:TelegramBotDto}>(`/api/telegram/bots/${encodeURIComponent(id)}`,'PATCH',input); },
  deleteTelegramBot(id:string){ return jsonRequest<{ok:boolean}>(`/api/telegram/bots/${encodeURIComponent(id)}`,'DELETE'); },
  getTelegramAllowlist(botId:string){ return request<{entries:TelegramAllowlistDto[]}>(`/api/telegram/bots/${encodeURIComponent(botId)}/allowlist`); },
  addTelegramAllowlist(botId:string,input:{phoneNumber:string;displayName?:string;notes?:string}){ return jsonRequest<{entry:TelegramAllowlistDto}>(`/api/telegram/bots/${encodeURIComponent(botId)}/allowlist`,'POST',input); },
  removeTelegramAllowlist(botId:string,entryId:string){ return request<{ok:boolean}>(`/api/telegram/bots/${encodeURIComponent(botId)}/allowlist?entryId=${encodeURIComponent(entryId)}`,{method:'DELETE'}); },
  getAdminOverview(workspaceId?:string){ return request<any>(`/api/admin/overview${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:""}`); },
  getTelegramUsers(workspaceId?:string){ return request<{users:TelegramUserDto[]}>(`/api/admin/telegram-users${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:""}`); },
  updateTelegramUser(id:string,status:'pending'|'allowed'|'blocked',limits?:Partial<Pick<TelegramUserDto,'dailyMessageLimit'|'monthlyMessageLimit'|'dailyTokenLimit'|'monthlyTokenLimit'>>){ return jsonRequest<{user:TelegramUserDto}>('/api/admin/telegram-users','PATCH',{id,status,...limits}); },
  getAnalytics(workspaceId?:string){ return request<AnalyticsDto & {note?:string}>(`/api/admin/analytics${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:""}`); },

  testProvidersHealth(workspaceId?: string): Promise<ProviderHealthOkDto> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return request(`/api/providers/health${query}`, { method: "POST" });
  },
};
