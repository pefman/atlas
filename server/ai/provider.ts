export interface AIModel {
  id: string;
  name: string;
}

export interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<string>;
  getModels(): Promise<AIModel[]>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export * from './ollama';
export * from './openai';
