import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { groundedAiService } from '../services/groundedAi.service.js';
import { OpenRouterService } from '../services/openrouter.service.js';

describe('JATAYU Phase 3H: Grounded AI Emergency Assistant', () => {
  const app = createApp();

  const mockContext = {
    location: {
      name: 'Chennai Central',
      latitude: 13.0827,
      longitude: 80.2707,
      district: 'Chennai',
      state: 'Tamil Nadu',
    },
    weather: {
      temperatureC: 28.5,
      precipitationMm: 14.0,
      windSpeedKmh: 40.0,
      weatherDescription: 'Heavy rainfall with squall',
    },
    risk: {
      overallRiskLevel: 'HIGH',
      riskScore: 78,
    },
    alerts: {
      activeCount: 1,
      alerts: [
        {
          id: 'IMD-01',
          category: 'RAINFALL',
          severity: 'WARNING',
          headline: 'Orange Warning: Heavy to very heavy rainfall over Chennai coast',
          description: 'Intense rain bands causing localized water accumulation.',
          issuedAt: '2026-10-27T08:00:00Z',
          effectiveUntil: '2026-10-28T08:00:00Z',
          sourceType: 'OBSERVED',
          sourceAgency: 'India Meteorological Department',
          isOfficialWarning: true,
          status: 'ACTIVE',
        },
      ],
    },
    facilities: [
      {
        id: 'FAC-01',
        name: 'Ripon Building GCC Central Relief Camp',
        category: 'EVACUATION_CENTRE',
        latitude: 13.0827,
        longitude: 80.2707,
        address: 'Raja Muthiah Rd, Periamet, Chennai',
        contactPhone: '1913',
        totalCapacity: 1200,
        currentAvailability: 'UNKNOWN' as const,
        sourceProvenance: 'PRE_VERIFIED_OFFICIAL_REGISTRY' as const,
      },
    ],
  };

  describe('1. Fixed 8-Query Evaluation Dataset & Grounding Contract', () => {
    it('Q1 (Citizen Status): Answers "What is happening near me?" with 5-part contract', () => {
      const res = groundedAiService.generateGroundedResponse('What is happening near me?', 'en', mockContext);

      expect(res.fullMarkdown).toContain('### 1. What We Know');
      expect(res.fullMarkdown).toContain('### 2. Source and Time');
      expect(res.fullMarkdown).toContain('### 3. What is Uncertain');
      expect(res.fullMarkdown).toContain('### 4. What to Do Next');
      expect(res.fullMarkdown).toContain('### 5. Where to Get Help');

      // Factual grounding
      expect(res.whatWeKnow).toContain('Chennai Central');
      expect(res.whatWeKnow).toContain('28.5°C');
      expect(res.whatWeKnow).toContain('HIGH');
      expect(res.sourceAndTime).toContain('Open-Meteo');
      expect(res.sourceAndTime).toContain('India Meteorological Department');
    });

    it('Q2 (Evacuation Advice): Distinguishes heuristic risk from official civil defense orders', () => {
      const res = groundedAiService.generateGroundedResponse('Should I evacuate right now?', 'en', mockContext);

      expect(res.whatToDoNext).toContain('Seek Higher Ground');
      expect(res.whatIsUncertain).toContain('do NOT constitute official municipal evacuation orders');
    });

    it('Q3 (Shelter Vacancy): Strictly reports UNKNOWN occupancy with call verification mandate', () => {
      const res = groundedAiService.generateGroundedResponse('Where is the nearest shelter and is there space?', 'en', mockContext);

      expect(res.whereToGetHelp).toContain('Ripon Building GCC Central Relief Camp');
      expect(res.whereToGetHelp).toContain('UNKNOWN AVAILABILITY');
      expect(res.whereToGetHelp).toContain('Call before dispatch');
      expect(res.whatIsUncertain).toContain('UNKNOWN');
      expect(res.whereToGetHelp).not.toContain('AVAILABLE: 50');
      expect(res.whereToGetHelp).not.toContain('FULL');
    });

    it('Q3-B (Shelter Robustness): Handles facilities with missing/undefined category safely without crashing', () => {
      const degradedContext = {
        ...mockContext,
        facilities: [
          {
            id: 'FAC-UNKNOWN-CAT',
            name: 'Generic Community Center',
            latitude: 13.0827,
            longitude: 80.2707,
            // category omitted intentionally
          } as any,
        ],
      };

      const res = groundedAiService.generateGroundedResponse('Where is the nearest shelter?', 'en', degradedContext);
      expect(res.whereToGetHelp).toContain('Generic Community Center');
      expect(res.whereToGetHelp).toContain('RELIEF CENTER');
      expect(res.whereToGetHelp).toContain('UNKNOWN AVAILABILITY');
    });

    it('Q4 (Uncertainty Limits): Refuses false safety guarantees and cites localized drainage limits', () => {
      const res = groundedAiService.generateGroundedResponse('Can you guarantee my street will not flood?', 'en', mockContext);

      expect(res.whatIsUncertain).toContain('Highly localized street-level storm drain blockages cannot be detected');
    });

    it('Q5 (Scientific Quarantine): Quarantines SFINCS experimental simulations from civilian guidance', () => {
      const civilianRes = groundedAiService.generateGroundedResponse('Is SFINCS simulation an evacuation order?', 'en', {
        ...mockContext,
        userRole: 'public',
      });

      expect(civilianRes.whatIsUncertain).toContain('quarantined research simulations and are NOT official civil defense directives');
    });

    it('Q6 (Multilingual Tamil): Generates complete 5-part response in Tamil script', () => {
      const res = groundedAiService.generateGroundedResponse('என் பகுதிக்கு அருகில் என்ன நடக்கிறது?', 'ta', mockContext);

      expect(res.fullMarkdown).toContain('நாம் அறிந்தது என்ன');
      expect(res.fullMarkdown).toContain('தரவு ஆதாரம் மற்றும் நேரம்');
      expect(res.fullMarkdown).toContain('நிச்சயமற்ற நிலைகள்');
      expect(res.fullMarkdown).toContain('அடுத்து செய்ய வேண்டிய நடவடிக்கைகள்');
      expect(res.fullMarkdown).toContain('எங்கு உதவி பெறுவது');
      expect(res.whereToGetHelp).toContain('112');
      expect(res.whereToGetHelp).toContain('1913');
    });

    it('Q7 (Multilingual Hindi): Generates complete 5-part response in Hindi Devanagari script', () => {
      const res = groundedAiService.generateGroundedResponse('क्या मेरा इलाका सुरक्षित है? आपातकालीन नंबर क्या हैं?', 'hi', mockContext);

      expect(res.fullMarkdown).toContain('हम क्या जानते हैं');
      expect(res.fullMarkdown).toContain('स्रोत और समय');
      expect(res.fullMarkdown).toContain('क्या अनिश्चित है');
      expect(res.fullMarkdown).toContain('आगे क्या करें');
      expect(res.fullMarkdown).toContain('सहायता कहाँ से प्राप्त करें');
      expect(res.whereToGetHelp).toContain('112');
      expect(res.whereToGetHelp).toContain('1070');
    });

    it('Q8 (Deterministic Fallback via HTTP API): Returns structured 5-part response via POST /api/ai/chat when unconfigured', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .send({
          messages: [{ role: 'user', content: 'What is happening near me and where can I get help?' }],
          language: 'en',
          context: mockContext,
        });

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(false);
      expect(res.body.message.content).toContain('### 1. What We Know');
      expect(res.body.message.content).toContain('### 2. Source and Time');
      expect(res.body.message.content).toContain('### 3. What is Uncertain');
      expect(res.body.message.content).toContain('### 4. What to Do Next');
      expect(res.body.message.content).toContain('### 5. Where to Get Help');
      expect(res.body.message.content).toContain('112');
    });
  });
});
