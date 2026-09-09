import session, { type Store } from 'express-session';
import { env } from '../config/env.js';
import { MariaDbSessionStore } from './mariaDbSessionStore.js';

export function createSessionStore(): Store {
  if (env.NODE_ENV === 'test') return new session.MemoryStore();
  return new MariaDbSessionStore();
}

export function createSessionMiddleware(store = createSessionStore()) {
  return session({
    name: 'pawprint.sid',
    secret: env.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  });
}
