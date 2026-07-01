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
    const url = `${this.endpoint}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    console.log('[OpenAI] Requesting:', url);
    console.log('[OpenAI] Headers:', JSON.stringify({ ...headers, Authorization: headers.Authorization ? 'Bearer ***' : undefined }));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('[OpenAI] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAI] Request failed:', errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[OpenAI] Response from server received');
      return data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
      throw error;
    }
  }

  async getModels(): Promise<AIModel[]> {
    const path = this.endpoint.endsWith('/v1') ? '/models' : '/v1/models';
    const url = `${this.endpoint}${path}`;
    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    console.log('[OpenAI] Fetching models from:', url);
    console.log('[OpenAI] Headers:', JSON.stringify({ ...headers, Authorization: headers.Authorization ? 'Bearer ***' : undefined }));
    
    const response = await fetch(url, {
      headers,
    });

    console.log('[OpenAI] Models request status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OpenAI] Models request failed:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const models = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.id,
    }));
    console.log('[OpenAI] Found', models.length, 'models:', models.map(m => m.id));
    return models;
  }
}
