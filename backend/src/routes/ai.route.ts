import { Router, Request, Response } from 'express';
import { OpenRouterService } from '../services/openrouter.service.js';
import { AIChatRequest } from '../types/ai.types.js';

export const aiRouter = Router();
const aiService = new OpenRouterService();

aiRouter.get('/status', (_req: Request, res: Response) => {
  const status = aiService.getStatus();
  res.status(200).json(status);
});

aiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const chatRequest = req.body as AIChatRequest;

    if (!chatRequest || !Array.isArray(chatRequest.messages) || chatRequest.messages.length === 0) {
      res.status(400).json({ error: 'Valid non-empty messages array is required.', code: 'INVALID_MESSAGES' });
      return;
    }

    if (chatRequest.messages.length > 25) {
      res.status(400).json({ error: 'Maximum message history limit exceeded (max 25 messages).', code: 'MESSAGE_LIMIT_EXCEEDED' });
      return;
    }

    for (const msg of chatRequest.messages) {
      if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        res.status(400).json({ error: 'Each message must have a valid role and content string.', code: 'INVALID_MESSAGE_FORMAT' });
        return;
      }
      if (msg.content.length > 4000) {
        res.status(400).json({ error: 'Message content exceeds maximum allowed length (4000 characters).', code: 'CONTENT_TOO_LARGE' });
        return;
      }
    }

    if (chatRequest.language && !['en', 'ta', 'hi'].includes(chatRequest.language)) {
      res.status(400).json({ error: 'Language must be one of: en, ta, hi', code: 'INVALID_LANGUAGE' });
      return;
    }

    const result = await aiService.generateChatResponse(chatRequest);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI request execution failed.', code: 'AI_EXECUTION_ERROR' });
  }
});
