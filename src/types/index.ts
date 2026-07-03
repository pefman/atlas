export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export type AgentStatus =
  | 'idle'
  | 'decomposing'
  | 'executing'
  | 'reading_email'
  | 'answering_email'
  | 'reviewing'
  | 'completed'
  | 'error';

export type StepType = 'decompose' | 'assign' | 'execute' | 'review';

export type RoleName =
  | 'ceo'
  | 'product_manager'
  | 'tech_lead'
  | 'frontend_developer'
  | 'backend_developer'
  | 'devops_engineer'
  | 'data_engineer'
  | 'ui_ux_designer'
  | 'security_engineer'
  | 'qa_engineer'
  | 'seo_specialist'
  | string;

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
  project_id?: number | null;
  project_name?: string;
  project_folder_path?: string;
  role_name?: string;
  role_id: number;
  status: TaskStatus;
  ceo_status: 'idle' | 'decomposing' | 'decomposed' | 'error';
  decomposed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  folder_path: string;
  is_active: number;
  task_count?: number;
  repo_count?: number;
  created_at: string;
  updated_at: string;
}

export interface RepoAsset {
  id: number;
  project_id: number;
  project_name?: string;
  project_folder_path?: string;
  name: string;
  provider?: string | null;
  remote_url?: string | null;
  local_path?: string | null;
  default_branch: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export type SubtaskStatus = TaskStatus | 'failed';

export interface Subtask {
  id: number;
  task_id: number;
  task_title?: string;
  title: string;
  description: string;
  role_id: number;
  role_name?: string;
  status: SubtaskStatus;
  priority: 'high' | 'medium' | 'low';
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

export interface AgentStats {
  inputTokens: number;
  outputTokens: number;
  totalCalls: number;
}

export interface LatestActivity {
  step_type: StepType;
  output: string;
  created_at: string;
  role_name: string;
}

export interface Agent {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  personality?: string;
  portrait?: string;
  funny_name?: string;
  gender?: 'male' | 'female';
  canonical?: boolean;
  selectable_by_ceo?: boolean;
  status: AgentStatus;
  current_task?: string;
  stats?: AgentStats | null;
  latestActivity?: LatestActivity | null;
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

export interface Notification {
  id: number;
  sender_role: string;
  message: string;
  task_id?: number;
  thread_id?: number;
  is_read: boolean;
  created_at: string;
}

export type MessageThreadStatus = 'open' | 'awaiting_user' | 'awaiting_agent' | 'resolved';
export type MessageSenderType = 'user' | 'agent' | 'system';
export type MessageThreadCategory = 'general' | 'clarification';

export interface MessageThread {
  id: number;
  role_id: number;
  role_name?: string;
  task_id?: number;
  subtask_id?: number;
  subject?: string;
  category?: MessageThreadCategory;
  status: MessageThreadStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_agent_messages?: number;
}

export interface Message {
  id: number;
  thread_id: number;
  role_id?: number;
  role_name?: string;
  sender_type: MessageSenderType;
  content: string;
  task_id?: number;
  subtask_id?: number;
  task_title?: string;
  subtask_title?: string;
  requires_response: number;
  is_read: number;
  created_at: string;
  updated_at: string;
}


