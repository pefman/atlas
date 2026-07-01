import { AIProvider, Message, AIModel } from './provider';

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private endpoint: string;
  private model: string;

  constructor(endpoint: string, model: string) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.model = model;
  }

  async chat(messages: Message[]): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.message.content;
  }

  async getModels(): Promise<AIModel[]> {
    const response = await fetch(`${this.endpoint}/api/tags`);
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.models || []).map((m: any) => ({
      id: m.name,
      name: m.name,
    }));
  }
}
