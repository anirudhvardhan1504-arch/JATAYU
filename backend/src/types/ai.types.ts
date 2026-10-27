export type SupportedLanguage = 'en' | 'ta' | 'hi';

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatRequest {
  messages: AIChatMessage[];
  language?: SupportedLanguage;
  context?: {
    location?: string;
    latitude?: number;
    longitude?: number;
    activeAlertsCount?: number;
    currentRiskLevel?: string;
  };
}

export interface AIChatResponse {
  message: AIChatMessage;
  model: string;
  configured: boolean;
  timestamp: string;
  error?: string;
}

export interface AIStatusResponse {
  configured: boolean;
  provider: 'OpenRouter';
  model: string;
  message: string;
}
