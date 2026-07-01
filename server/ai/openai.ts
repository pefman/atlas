import { AIProvider, Message, AIModel } from './provider';

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(apiKey: string, model: string, endpoint?: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = (endpoint || 'https://api.openai.com').replace(/\/$/, '');
  }

  async chat(messages: Message[]): Promise<string> {
    const path = this.endpoint.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    const response = await fetch(`${this.endpoint}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async getModels(): Promise<AIModel[]> {
    const path = this.endpoint.endsWith('/v1') ? '/models' : '/v1/models';
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    const response = await fetch(`${this.endpoint}${path}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.id,
    }));
  }
}
