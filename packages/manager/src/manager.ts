/**
 * Mapgen Manager - Core Manager
 * Implements install, CRUD, and version management for mapgen configs
 */

import { randomUUID } from 'node:crypto';
import { Storage } from './storage.js';
import type {
  MapgenConfig,
  ManagerState,
  CommandResult,
  CreateConfigOptions,
  UpdateConfigOptions,
  ListFilter,
  VersionEntry,
  MapgenParams,
} from './types.js';

export class MapgenManager {
  private storage: Storage;

  constructor(rootDir?: string) {
    this.storage = new Storage(rootDir);
  }

  /** Get the .mapgen directory path */
  get dir(): string {
    return this.storage.dir;
  }

  // ─── Installation ───────────────────────────────────────────

  /**
   * Initialize a .mapgen directory in the current or specified directory.
   * Creates the directory structure and initial state file.
   */
  async init(): Promise<CommandResult> {
    const alreadyExists = await this.storage.exists();
    if (alreadyExists) {
      return {
        success: false,
        message: '.mapgen directory already exists. Use "mapgen install" to update.',
      };
    }

    await this.storage.init();
    return {
      success: true,
      message: `Initialized .mapgen directory at ${this.dir}`,
    };
  }

  /**
   * Install/update mapgen. Ensures .mapgen directory exists and is up to date.
   */
  async install(): Promise<CommandResult> {
    const exists = await this.storage.exists();
    if (!exists) {
      await this.storage.init();
      return {
        success: true,
        message: `Installed mapgen at ${this.dir}`,
      };
    }

    // Validate and repair state if needed
    try {
      const state = await this.storage.readState();
      if (state.schemaVersion < 1) {
        state.schemaVersion = 1;
        await this.storage.writeState(state);
      }
      return {
        success: true,
        message: `mapgen is up to date at ${this.dir}`,
      };
    } catch {
      // State file is corrupted, reinitialize
      await this.storage.init();
      return {
        success: true,
        message: `Repaired mapgen installation at ${this.dir}`,
      };
    }
  }

  /**
   * Check if mapgen is installed in the current directory.
   */
  async isInstalled(): Promise<boolean> {
    return this.storage.exists();
  }

  // ─── CRUD Operations ───────────────────────────────────────

  /**
   * Create a new mapgen configuration.
   */
  async createConfig(options: CreateConfigOptions): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    const id = this.generateId(options.name);

    // Check for duplicate name
    if (state.configs.some((c) => c.name === options.name)) {
      return {
        success: false,
        message: `Config "${options.name}" already exists. Use "mapgen update" to modify it.`,
      };
    }

    const now = Date.now();
    const config: MapgenConfig = {
      id,
      name: options.name,
      description: options.description,
      createdAt: now,
      updatedAt: now,
      version: state.versions.current,
      params: options.params,
      metadata: options.metadata,
    };

    state.configs.push(config);
    await this.storage.writeState(state);
    await this.storage.writeConfigFile(id, config);

    return {
      success: true,
      message: `Created config "${options.name}" (${id})`,
      data: config,
    };
  }

  /**
   * Read a single config by name or id.
   */
  async readConfig(nameOrId: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    const config = state.configs.find(
      (c) => c.name === nameOrId || c.id === nameOrId
    );

    if (!config) {
      return {
        success: false,
        message: `Config "${nameOrId}" not found.`,
      };
    }

    return {
      success: true,
      message: `Config "${config.name}"`,
      data: config,
    };
  }

  /**
   * List all configs, optionally filtered.
   */
  async listConfigs(filter?: ListFilter): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    let configs = [...state.configs];

    // Apply filters
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      configs = configs.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      );
    }

    if (filter?.version) {
      configs = configs.filter((c) => c.version === filter.version);
    }

    // Sort
    const sortBy = filter?.sortBy ?? 'updatedAt';
    const sortDir = filter?.sortDir ?? 'desc';
    configs.sort((a, b) => {
      const av = a[sortBy] as number | string;
      const bv = b[sortBy] as number | string;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return {
      success: true,
      message: `Found ${configs.length} config(s)`,
      data: configs,
    };
  }

  /**
   * Update an existing config by name or id.
   */
  async updateConfig(
    nameOrId: string,
    updates: UpdateConfigOptions
  ): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    const idx = state.configs.findIndex(
      (c) => c.name === nameOrId || c.id === nameOrId
    );

    if (idx === -1) {
      return {
        success: false,
        message: `Config "${nameOrId}" not found.`,
      };
    }

    const config = state.configs[idx];

    // Check name uniqueness if renaming
    if (updates.name && updates.name !== config.name) {
      if (state.configs.some((c) => c.name === updates.name && c.id !== config.id)) {
        return {
          success: false,
          message: `Config "${updates.name}" already exists.`,
        };
      }
      config.name = updates.name;
    }

    if (updates.description !== undefined) {
      config.description = updates.description;
    }

    if (updates.params) {
      config.params = { ...config.params, ...updates.params };
    }

    if (updates.metadata) {
      config.metadata = { ...config.metadata, ...updates.metadata };
    }

    config.updatedAt = Date.now();
    state.configs[idx] = config;

    await this.storage.writeState(state);
    await this.storage.writeConfigFile(config.id, config);

    return {
      success: true,
      message: `Updated config "${config.name}"`,
      data: config,
    };
  }

  /**
   * Delete a config by name or id.
   */
  async deleteConfig(nameOrId: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    const idx = state.configs.findIndex(
      (c) => c.name === nameOrId || c.id === nameOrId
    );

    if (idx === -1) {
      return {
        success: false,
        message: `Config "${nameOrId}" not found.`,
      };
    }

    const config = state.configs[idx];
    state.configs.splice(idx, 1);

    await this.storage.writeState(state);

    try {
      await this.storage.deleteConfigFile(config.id);
    } catch {
      // Config file may not exist, that's okay
    }

    return {
      success: true,
      message: `Deleted config "${config.name}"`,
    };
  }

  // ─── Version Management ─────────────────────────────────────

  /**
   * List all versions.
   */
  async listVersions(): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    return {
      success: true,
      message: `Current version: ${state.versions.current}`,
      data: state.versions,
    };
  }

  /**
   * Create a new version snapshot.
   */
  async createVersion(
    tag: string,
    description?: string
  ): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();

    if (state.versions.versions.some((v) => v.tag === tag)) {
      return {
        success: false,
        message: `Version "${tag}" already exists.`,
      };
    }

    const entry: VersionEntry = {
      tag,
      createdAt: Date.now(),
      description,
      configIds: state.configs.map((c) => c.id),
    };

    state.versions.versions.push(entry);
    state.versions.current = tag;

    await this.storage.writeState(state);
    await this.storage.writeVersions(state.versions);

    return {
      success: true,
      message: `Created and switched to version "${tag}"`,
      data: entry,
    };
  }

  /**
   * Switch to an existing version.
   */
  async useVersion(tag: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();
    const entry = state.versions.versions.find((v) => v.tag === tag);

    if (!entry) {
      return {
        success: false,
        message: `Version "${tag}" not found.`,
      };
    }

    state.versions.current = tag;
    await this.storage.writeState(state);
    await this.storage.writeVersions(state.versions);

    return {
      success: true,
      message: `Switched to version "${tag}"`,
    };
  }

  /**
   * Delete a version (cannot delete current version).
   */
  async deleteVersion(tag: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.storage.readState();

    if (tag === state.versions.current) {
      return {
        success: false,
        message: `Cannot delete the current version "${tag}". Switch to another version first.`,
      };
    }

    const idx = state.versions.versions.findIndex((v) => v.tag === tag);
    if (idx === -1) {
      return {
        success: false,
        message: `Version "${tag}" not found.`,
      };
    }

    state.versions.versions.splice(idx, 1);
    await this.storage.writeState(state);
    await this.storage.writeVersions(state.versions);

    return {
      success: true,
      message: `Deleted version "${tag}"`,
    };
  }

  /**
   * Get the current version tag.
   */
  async getCurrentVersion(): Promise<string> {
    const state = await this.storage.readState();
    return state.versions.current;
  }

  // ─── Internal ───────────────────────────────────────────────

  private async ensureInstalled(): Promise<void> {
    if (!(await this.storage.exists())) {
      await this.storage.init();
    }
  }

  private generateId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const short = randomUUID().split('-')[0];
    return `${slug}-${short}`;
  }
}
