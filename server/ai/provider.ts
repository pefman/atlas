export interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<string>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export * from './ollama';
export * from './openai';
