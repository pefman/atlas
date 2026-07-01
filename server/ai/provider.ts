export interface AIModel {
  id: string;
  name: string;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface ChatResponse {
  content: string;
  usage?: TokenUsage;
}

export interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<ChatResponse>;
  getModels(): Promise<AIModel[]>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export * from './ollama';
export * from './openai';
