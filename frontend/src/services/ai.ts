import { fetchJson } from './api';
import { AIChatMessage, AIChatResponse, AIStatusResponse } from '../types';

export async function getAIStatus(): Promise<AIStatusResponse> {
  return fetchJson<AIStatusResponse>('/ai/status');
}

export async function sendAIChat(
  messages: AIChatMessage[],
  context?: Record<string, any>,
  language?: 'en' | 'ta' | 'hi'
): Promise<AIChatResponse> {
  return fetchJson<AIChatResponse>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, context, language }),
  });
}
