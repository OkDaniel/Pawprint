import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('returns the service health envelope', async () => {
    const response = await request(createApp()).get('/api/health').expect(200);
    expect(response.body.data).toMatchObject({ status: 'ok', service: 'capstone-api' });
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });
});

