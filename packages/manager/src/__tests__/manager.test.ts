import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MapgenManager } from '../manager.js';
import type { CreateConfigOptions } from '../types.js';

let tmpDir: string;
let manager: MapgenManager;

const testParams = {
  seedStr: 'test-seed',
  plateCount: 10,
  landmass: 0.5,
  noiseType: 'perlin',
  fbmType: 'standard',
};

const testConfig: CreateConfigOptions = {
  name: 'test-map',
  description: 'A test map configuration',
  params: testParams,
};

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'mapgen-test-'));
  manager = new MapgenManager(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('Installation', () => {
  it('should initialize .mapgen directory', async () => {
    const result = await manager.init();
    expect(result.success).toBe(true);
    expect(result.message).toContain('Initialized');
    expect(await manager.isInstalled()).toBe(true);
  });

  it('should not reinitialize if already exists', async () => {
    await manager.init();
    const result = await manager.init();
    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  it('should install and initialize if not exists', async () => {
    const result = await manager.install();
    expect(result.success).toBe(true);
    expect(await manager.isInstalled()).toBe(true);
  });

  it('should be idempotent if already installed', async () => {
    await manager.install();
    const result = await manager.install();
    expect(result.success).toBe(true);
    expect(result.message).toContain('up to date');
  });
});

describe('CRUD - Create', () => {
  it('should create a config', async () => {
    await manager.init();
    const result = await manager.createConfig(testConfig);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Created');
    expect(result.data).toBeDefined();
    expect((result.data as { name: string }).name).toBe('test-map');
  });

  it('should auto-install if not initialized', async () => {
    const result = await manager.createConfig(testConfig);
    expect(result.success).toBe(true);
    expect(await manager.isInstalled()).toBe(true);
  });

  it('should reject duplicate names', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    const result = await manager.createConfig(testConfig);
    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  it('should store metadata', async () => {
    await manager.init();
    const result = await manager.createConfig({
      ...testConfig,
      metadata: { tags: ['fantasy', 'continent'] },
    });
    expect(result.success).toBe(true);
    expect((result.data as { metadata: { tags: string[] } }).metadata?.tags).toEqual([
      'fantasy',
      'continent',
    ]);
  });
});

describe('CRUD - Read', () => {
  it('should read a config by name', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    const result = await manager.readConfig('test-map');
    expect(result.success).toBe(true);
    expect((result.data as { name: string }).name).toBe('test-map');
  });

  it('should read a config by id', async () => {
    await manager.init();
    const created = await manager.createConfig(testConfig);
    const id = (created.data as { id: string }).id;
    const result = await manager.readConfig(id);
    expect(result.success).toBe(true);
  });

  it('should fail for nonexistent config', async () => {
    await manager.init();
    const result = await manager.readConfig('nonexistent');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});

describe('CRUD - List', () => {
  it('should list all configs', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    await manager.createConfig({ ...testConfig, name: 'second-map' });
    const result = await manager.listConfigs();
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBe(2);
  });

  it('should filter by search term', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    await manager.createConfig({ ...testConfig, name: 'world-map' });
    const result = await manager.listConfigs({ search: 'world' });
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBe(1);
  });

  it('should return empty list when no configs', async () => {
    await manager.init();
    const result = await manager.listConfigs();
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBe(0);
  });
});

describe('CRUD - Update', () => {
  it('should update config name', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    const result = await manager.updateConfig('test-map', { name: 'renamed-map' });
    expect(result.success).toBe(true);
    expect((result.data as { name: string }).name).toBe('renamed-map');
  });

  it('should update config params', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    const result = await manager.updateConfig('test-map', {
      params: { landmass: 0.8 },
    });
    expect(result.success).toBe(true);
    expect((result.data as { params: { landmass: number } }).params.landmass).toBe(0.8);
  });

  it('should fail for nonexistent config', async () => {
    await manager.init();
    const result = await manager.updateConfig('nonexistent', { name: 'new' });
    expect(result.success).toBe(false);
  });
});

describe('CRUD - Delete', () => {
  it('should delete a config', async () => {
    await manager.init();
    await manager.createConfig(testConfig);
    const result = await manager.deleteConfig('test-map');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Deleted');

    const list = await manager.listConfigs();
    expect((list.data as unknown[]).length).toBe(0);
  });

  it('should fail for nonexistent config', async () => {
    await manager.init();
    const result = await manager.deleteConfig('nonexistent');
    expect(result.success).toBe(false);
  });
});

describe('Version Management', () => {
  it('should list versions', async () => {
    await manager.init();
    const result = await manager.listVersions();
    expect(result.success).toBe(true);
    expect((result.data as { versions: unknown[] }).versions.length).toBe(1);
    expect((result.data as { current: string }).current).toBe('initial');
  });

  it('should create a new version', async () => {
    await manager.init();
    const result = await manager.createVersion('v1.0', 'First release');
    expect(result.success).toBe(true);
    expect((result.data as { tag: string }).tag).toBe('v1.0');

    const current = await manager.getCurrentVersion();
    expect(current).toBe('v1.0');
  });

  it('should reject duplicate version tags', async () => {
    await manager.init();
    await manager.createVersion('v1.0');
    const result = await manager.createVersion('v1.0');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
  });

  it('should switch versions', async () => {
    await manager.init();
    await manager.createVersion('v1.0');
    await manager.createVersion('v2.0');
    const result = await manager.useVersion('v1.0');
    expect(result.success).toBe(true);

    const current = await manager.getCurrentVersion();
    expect(current).toBe('v1.0');
  });

  it('should not delete current version', async () => {
    await manager.init();
    await manager.createVersion('v1.0');
    const result = await manager.deleteVersion('v1.0');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Cannot delete');
  });

  it('should delete non-current version', async () => {
    await manager.init();
    await manager.createVersion('v1.0');
    await manager.createVersion('v2.0');
    const result = await manager.deleteVersion('v1.0');
    expect(result.success).toBe(true);

    const versions = await manager.listVersions();
    expect((versions.data as { versions: { tag: string }[] }).versions.length).toBe(2); // initial + v2.0
  });
});
