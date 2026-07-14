/**
 * Mapgen Manager - Storage Layer
 * Handles .mapgen directory and JSON file I/O
 */

import { readFile, writeFile, mkdir, access, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { ManagerState, VersionManifest } from './types.js';

const MAPGEN_DIR = '.mapgen';
const STATE_FILE = 'state.json';
const VERSIONS_FILE = 'versions.json';
const CONFIGS_DIR = 'configs';
const SCHEMA_VERSION = 1;

export class Storage {
  private rootDir: string;
  private mapgenDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = resolve(rootDir);
    this.mapgenDir = join(this.rootDir, MAPGEN_DIR);
  }

  /** Get the .mapgen directory path */
  get dir(): string {
    return this.mapgenDir;
  }

  /** Check if .mapgen directory exists */
  async exists(): Promise<boolean> {
    try {
      await access(this.mapgenDir);
      return true;
    } catch {
      return false;
    }
  }

  /** Initialize .mapgen directory structure */
  async init(): Promise<void> {
    await mkdir(this.mapgenDir, { recursive: true });
    await mkdir(join(this.mapgenDir, CONFIGS_DIR), { recursive: true });

    const state: ManagerState = {
      schemaVersion: SCHEMA_VERSION,
      initializedAt: Date.now(),
      mapgenVersion: '0.0.4-pre',
      configs: [],
      versions: {
        current: 'initial',
        versions: [
          {
            tag: 'initial',
            createdAt: Date.now(),
            description: 'Initial state',
            configIds: [],
          },
        ],
      },
    };

    await this.writeState(state);
  }

  /** Read the full manager state */
  async readState(): Promise<ManagerState> {
    const filePath = join(this.mapgenDir, STATE_FILE);
    const raw = await readFile(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as ManagerState;
    } catch {
      throw new Error(`Corrupted state file: ${filePath}`);
    }
  }

  /** Write the full manager state */
  async writeState(state: ManagerState): Promise<void> {
    const filePath = join(this.mapgenDir, STATE_FILE);
    await writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  /** Read version manifest */
  async readVersions(): Promise<VersionManifest> {
    const filePath = join(this.mapgenDir, VERSIONS_FILE);
    try {
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as VersionManifest;
    } catch {
      const state = await this.readState();
      return state.versions;
    }
  }

  /** Write version manifest */
  async writeVersions(manifest: VersionManifest): Promise<void> {
    const filePath = join(this.mapgenDir, VERSIONS_FILE);
    await writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /** List config files in .mapgen/configs/ */
  async listConfigFiles(): Promise<string[]> {
    const configsDir = join(this.mapgenDir, CONFIGS_DIR);
    try {
      const files = await readdir(configsDir);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  /** Read a single config file by id */
  async readConfigFile(id: string): Promise<unknown> {
    const filePath = join(this.mapgenDir, CONFIGS_DIR, `${id}.json`);
    const raw = await readFile(filePath, 'utf-8');
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`Corrupted config file: ${filePath}`);
    }
  }

  /** Write a single config file */
  async writeConfigFile(id: string, data: unknown): Promise<void> {
    const filePath = join(this.mapgenDir, CONFIGS_DIR, `${id}.json`);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Delete a single config file */
  async deleteConfigFile(id: string): Promise<void> {
    const filePath = join(this.mapgenDir, CONFIGS_DIR, `${id}.json`);
    await unlink(filePath);
  }

  /** Check if a config file exists */
  async configExists(id: string): Promise<boolean> {
    try {
      await stat(join(this.mapgenDir, CONFIGS_DIR, `${id}.json`));
      return true;
    } catch {
      return false;
    }
  }
}
