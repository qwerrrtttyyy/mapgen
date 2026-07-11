import { Hono } from 'hono';
import type { MapStorage } from '../services/mapStorage.js';
import type { CreateMapRequest, MapFilter } from '@mapgen/shared-types';

export function createMapsRoute(storage: MapStorage): Hono {
  const app = new Hono();

  app.post('/maps', async c => {
    const body = await c.req.json<CreateMapRequest>();
    if (!body.map) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing map data' } }, 400);
    }
    const ref = storage.save(body.map, body.meta);
    return c.json(ref, 201);
  });

  app.get('/maps', c => {
    const query = c.req.query();
    const filter: MapFilter = {
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
      search: query.search,
      tags: Array.isArray(query.tags) ? query.tags : query.tags ? [query.tags] : undefined,
    };
    return c.json(storage.list(filter));
  });

  app.get('/maps/:id', c => {
    const id = c.req.param('id');
    const map = storage.load(id);
    if (!map) return c.json({ error: { code: 'MAP_NOT_FOUND', message: 'Map not found' } }, 404);
    return c.json(map);
  });

  app.delete('/maps/:id', c => {
    const id = c.req.param('id');
    const deleted = storage.delete(id);
    return c.body(null, deleted ? 204 : 404);
  });

  return app;
}
