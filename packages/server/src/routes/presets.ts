import { Hono } from 'hono';
import type { InMemoryDatabase } from '../db/index.js';

export function createPresetsRoute(db: InMemoryDatabase) {
  const app = new Hono();

  app.get('/presets', c => {
    const rows = Array.from(db.presets.values()).sort((a, b) => b.createdAt - a.createdAt);
    return c.json({
      presets: rows.map(r => ({ ...r, params: JSON.parse(r.params), builtin: !!r.builtin })),
    });
  });

  return app;
}
