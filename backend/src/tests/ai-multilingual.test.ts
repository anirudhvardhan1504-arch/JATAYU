import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { OpenRouterService } from '../services/openrouter.service.js';

describe('AI Multilingual & Deterministic Scaffolding Fallback Tests', () => {
  let aiService: OpenRouterService;

  beforeEach(() => {
    aiService = new OpenRouterService();
  });

  const sampleContext = {
    location: 'Chennai Coastal Basin',
    latitude: 13.0827,
    longitude: 80.2707,
    weather: {
      temperatureC: 29.5,
      precipitationMm: 18.5,
      windSpeedKmh: 42.0,
      isStale: false,
    },
    floodRisk: {
      category: 'CRITICAL',
      score: 88,
    },
    alerts: {
      activeCount: 1,
      highestSeverity: 'WARNING',
      alerts: [
        {
          id: 'ALT-IMD-CHE-01',
          severity: 'WARNING',
        },
      ],
    },
  };

  it('generates deterministic English SITREP by default or when language is en', async () => {
    const res = await aiService.generateChatResponse({
      messages: [{ role: 'user', content: 'What is the flood status in Chennai?' }],
      language: 'en',
      context: sampleContext,
    });

    expect(res.configured).toBe(false);
    expect(res.message.content).toContain('[JATAYU DISASTER AI — OPENROUTER GATEWAY NOTICE]');
    expect(res.message.content).toContain('DETERMINISTIC SITUATIONAL TELEMETRY (CHENNAI COASTAL BASIN)');
    expect(res.message.content).toContain('13.0827°N, 80.2707°E');
    expect(res.message.content).toContain('CRITICAL (Score: 88/100)');
    expect(res.message.content).toContain('Official IMD warnings vs unvalidated internal flood screening');
  });

  it('generates deterministic Tamil SITREP when language is ta', async () => {
    const res = await aiService.generateChatResponse({
      messages: [{ role: 'user', content: 'சென்னையில் தற்போதைய வானிலை என்ன?' }],
      language: 'ta',
      context: sampleContext,
    });

    expect(res.configured).toBe(false);
    expect(res.message.content).toContain('[ஜடாயு பேரிடர் AI — ஓபன்ரூட்டர் கேட்வே அறிவிப்பு]');
    expect(res.message.content).toContain('திட்டவட்டமான சூழ்நிலை தொலைத்தொடர்பு (CHENNAI COASTAL BASIN)');
    expect(res.message.content).toContain('13.0827°N, 80.2707°E');
    expect(res.message.content).toContain('வெப்பநிலை 29.5°C');
    expect(res.message.content).toContain('மழை 18.5 mm/h');
    expect(res.message.content).toContain('அதிகாரப்பூர்வ IMD எச்சரிக்கைகள் vs சரிபார்க்கப்படாத உள் வெள்ள திரையிடல்');

    // Confirm presence of Tamil Unicode range
    expect(/[\u0B80-\u0BFF]/.test(res.message.content)).toBe(true);
  });

  it('generates deterministic Hindi SITREP when language is hi', async () => {
    const res = await aiService.generateChatResponse({
      messages: [{ role: 'user', content: 'चेन्नई में बाढ़ की स्थिति क्या है?' }],
      language: 'hi',
      context: sampleContext,
    });

    expect(res.configured).toBe(false);
    expect(res.message.content).toContain('[जटायु आपदा AI — ओपनरूटर गेटवे सूचना]');
    expect(res.message.content).toContain('नियत स्थितिजन्य टेलीमेट्री (CHENNAI COASTAL BASIN)');
    expect(res.message.content).toContain('13.0827°N, 80.2707°E');
    expect(res.message.content).toContain('तापमान 29.5°C');
    expect(res.message.content).toContain('वर्षा 18.5 mm/h');
    expect(res.message.content).toContain('आधिकारिक IMD चेतावनियाँ बनाम असत्यापित आंतरिक बाढ़ स्क्रीनिंग');

    // Confirm presence of Devanagari Unicode range
    expect(/[\u0900-\u097F]/.test(res.message.content)).toBe(true);
  });

  it('auto-detects Tamil and Hindi from prompt messages when language is omitted', async () => {
    // Tamil auto-detection
    const resTa = await aiService.generateChatResponse({
      messages: [{ role: 'user', content: 'சென்னையில் மழை பெய்யுமா?' }],
      context: sampleContext,
    });
    expect(/[\u0B80-\u0BFF]/.test(resTa.message.content)).toBe(true);
    expect(resTa.message.content).toContain('[ஜடாயு பேரிடர் AI');

    // Hindi auto-detection
    const resHi = await aiService.generateChatResponse({
      messages: [{ role: 'user', content: 'क्या चेन्नई में तेज बारिश होगी?' }],
      context: sampleContext,
    });
    expect(/[\u0900-\u097F]/.test(resHi.message.content)).toBe(true);
    expect(resHi.message.content).toContain('[जटायु आपदा AI');
  });

  it('POST /api/ai/chat accepts language parameter and returns localized response', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'Flood situation report' }],
        language: 'ta',
        context: sampleContext,
      });

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    expect(/[\u0B80-\u0BFF]/.test(res.body.message.content)).toBe(true);
    expect(res.body.message.content).toContain('[ஜடாயு பேரிடர் AI');
  });

  it('POST /api/ai/chat rejects unsupported language with 400', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'Hello' }],
        language: 'fr',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_LANGUAGE');
  });
});
