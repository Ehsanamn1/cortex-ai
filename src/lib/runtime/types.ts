export type ExecutionStatus = "QUEUED" | "RUNNING" | "WAITING" | "COMPLETED" | "FAILED" | "CANCELLED";
export interface ToolContext { workspaceId: string; agentId: string; conversationId?: string; executionId: string; }
export interface ToolDefinitionRuntime { id: string; key: string; name: string; description: string; inputSchema: string; permissions: string; kind: string; }
export interface ToolExecutionResult { ok: boolean; output: unknown; error?: string; }
export interface AgentRuntimeInput { workspaceId: string; agentId: string; input: string; conversationId?: string; history: Array<{ role: "user" | "assistant"; content: string }>; }
