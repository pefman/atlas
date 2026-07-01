export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export type AgentStatus = 'idle' | 'decomposing' | 'executing' | 'reviewing' | 'completed' | 'error';

export type StepType = 'decompose' | 'assign' | 'execute' | 'review';

export type RoleName = 'planner' | 'researcher' | 'writer' | 'reviewer' | 'ceo';

export interface Role {
  id: number;
  name: RoleName;
  description: string;
  system_prompt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  role_id: number;
  status: TaskStatus;
  ceo_status: 'idle' | 'decomposing' | 'decomposed' | 'error';
  decomposed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  description: string;
  role_id: number;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Output {
  id: number;
  subtask_id: number;
  content: string;
  created_at: string;
}

export interface ExecutionLog {
  id: number;
  subtask_id: number;
  step: number;
  step_type: StepType;
  role_id: number;
  input: string;
  output: string;
  created_at: string;
}

export interface Settings {
  id: number;
  provider: 'ollama' | 'openai' | 'custom';
  endpoint: string;
  api_key?: string;
  model: string;
  created_at: string;
  updated_at: string;
}
