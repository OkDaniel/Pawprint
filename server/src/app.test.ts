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

describe('private API authorization', () => {
  it.each(['/api/check-ins', '/api/factors', '/api/feelings', '/api/symptoms?category=Mental', '/api/auth/me'])('rejects anonymous access to %s', async (path) => {
    await request(createApp()).get(path).expect(401);
  });
  it('rejects anonymous check-in creation', async () => {
    await request(createApp()).post('/api/check-ins').send({ mood: 4, factorIds: [] }).expect(401);
  });
  it('rejects anonymous custom-item creation', async () => {
    await request(createApp()).post('/api/feelings').send({ name: 'Private' }).expect(401);
    await request(createApp()).post('/api/symptoms').send({ name: 'Private', category: 'Mental' }).expect(401);
    await request(createApp()).post('/api/factors').send({ name: 'Private', category: 'Lifestyle' }).expect(401);
  });
  it('rejects anonymous preference updates and custom-item deactivation', async () => {
    await request(createApp()).put('/api/feelings/preferences').send({ ids: [] }).expect(401);
    await request(createApp()).delete('/api/feelings/1').expect(401);
  });
});
