import { AIProvider, Message, AIModel, ChatResponse } from './provider';

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private endpoint: string;
  private model: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.model = model;
  }

  async chat(messages: Message[]): Promise<ChatResponse> {
    const url = `${this.endpoint}/api/chat`;
    console.log('[Ollama] Requesting:', url);
    console.log('[Ollama] Model:', this.model);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    console.log('[Ollama] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ollama] Request failed:', errorText);
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Ollama] Response received');
    
    const usage = data.usage ? {
      input: data.usage.prompt_eval_count || 0,
      output: data.usage.eval_count || 0,
    } : undefined;
    
    return {
      content: data.message.content,
      usage,
    };
  }

  async getModels(): Promise<AIModel[]> {
    const url = `${this.endpoint}/api/tags`;
    console.log('[Ollama] Fetching models from:', url);
    
    const response = await fetch(url);
    
    console.log('[Ollama] Models request status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Ollama] Models request failed:', errorText);
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const models = (data.models || []).map((m: any) => ({
      id: m.name,
      name: m.name,
    }));
    console.log('[Ollama] Found', models.length, 'models:', models.map(m => m.id));
    return models;
  }
}
