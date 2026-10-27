import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Backend Health & API Gateway', () => {
  it('GET /api/health should return 200 with operational metadata', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.platform).toBe('JATAYU Disaster Intelligence Platform');
    expect(res.body.phase).toBe('Phase 1 Scaffolding');
    expect(res.body.services).toBeDefined();
    expect(res.body.services.ai).toBeDefined();
    expect(res.body.services.ai.provider).toBe('OpenRouter');
  });

  it('GET /api/ai/status should report configuration status gracefully without erroring', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('OpenRouter');
    expect(typeof res.body.configured).toBe('boolean');
  });
});
