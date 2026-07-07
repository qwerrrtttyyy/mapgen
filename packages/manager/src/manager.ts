import { randomUUID } from 'node:crypto';
import { Storage } from './storage.js';
import type {
  MapgenConfig,
  CommandResult,
  CreateConfigOptions,
  UpdateConfigOptions,
  ListFilter,
  VersionEntry,
  ManagerState,
} from './types.js';

export class MapgenManager {
  private storage: Storage;
  private stateCache: ManagerState | null = null;

  constructor(rootDir?: string) {
    this.storage = new Storage(rootDir);
  }

  get dir(): string {
    return this.storage.dir;
  }

  async init(): Promise<CommandResult> {
    const alreadyExists = await this.storage.exists();
    if (alreadyExists) {
      return {
        success: false,
        message: '.mapgen directory already exists. Use "mapgen install" to update.',
      };
    }

    await this.storage.init();
    this.invalidateCache();
    return {
      success: true,
      message: `Initialized .mapgen directory at ${this.dir}`,
    };
  }

  async install(): Promise<CommandResult> {
    const exists = await this.storage.exists();
    if (!exists) {
      await this.storage.init();
      this.invalidateCache();
      return {
        success: true,
        message: `Installed mapgen at ${this.dir}`,
      };
    }

    try {
      const state = await this.readState();
      if (state.schemaVersion < 1) {
        state.schemaVersion = 1;
        await this.writeState(state);
      }
      return {
        success: true,
        message: `mapgen is up to date at ${this.dir}`,
      };
    } catch {
      await this.storage.init();
      this.invalidateCache();
      return {
        success: true,
        message: `Repaired mapgen installation at ${this.dir}`,
      };
    }
  }

  async isInstalled(): Promise<boolean> {
    return this.storage.exists();
  }

  async createConfig(options: CreateConfigOptions): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    const id = this.generateId(options.name);

    if (this.findConfigByName(state, options.name)) {
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
    await this.writeState(state);
    await this.storage.writeConfigFile(id, config);

    return {
      success: true,
      message: `Created config "${options.name}" (${id})`,
      data: config,
    };
  }

  async readConfig(nameOrId: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    const config = this.findConfig(state, nameOrId);

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

  async listConfigs(filter?: ListFilter): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    let configs = [...state.configs];

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      configs = configs.filter(
        c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
      );
    }

    if (filter?.version) {
      configs = configs.filter(c => c.version === filter.version);
    }

    const sortBy = filter?.sortBy ?? 'updatedAt';
    const sortDir = filter?.sortDir ?? 'desc';
    configs.sort((a, b) => this.sortConfigs(a, b, sortBy, sortDir));

    return {
      success: true,
      message: `Found ${configs.length} config(s)`,
      data: configs,
    };
  }

  async updateConfig(nameOrId: string, updates: UpdateConfigOptions): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    const idx = this.findConfigIndex(state, nameOrId);

    if (idx === -1) {
      return {
        success: false,
        message: `Config "${nameOrId}" not found.`,
      };
    }

    const config = state.configs[idx];

    if (updates.name && updates.name !== config.name) {
      if (this.findConfigByName(state, updates.name, config.id)) {
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

    await this.writeState(state);
    await this.storage.writeConfigFile(config.id, config);

    return {
      success: true,
      message: `Updated config "${config.name}"`,
      data: config,
    };
  }

  async deleteConfig(nameOrId: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    const idx = this.findConfigIndex(state, nameOrId);

    if (idx === -1) {
      return {
        success: false,
        message: `Config "${nameOrId}" not found.`,
      };
    }

    const config = state.configs[idx];
    state.configs.splice(idx, 1);

    await this.writeState(state);

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

  async listVersions(): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    return {
      success: true,
      message: `Current version: ${state.versions.current}`,
      data: state.versions,
    };
  }

  async createVersion(tag: string, description?: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();

    if (this.findVersion(state, tag)) {
      return {
        success: false,
        message: `Version "${tag}" already exists.`,
      };
    }

    const entry: VersionEntry = {
      tag,
      createdAt: Date.now(),
      description,
      configIds: state.configs.map(c => c.id),
    };

    state.versions.versions.push(entry);
    state.versions.current = tag;

    await this.writeState(state);
    await this.storage.writeVersions(state.versions);

    return {
      success: true,
      message: `Created and switched to version "${tag}"`,
      data: entry,
    };
  }

  async useVersion(tag: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();
    const entry = this.findVersion(state, tag);

    if (!entry) {
      return {
        success: false,
        message: `Version "${tag}" not found.`,
      };
    }

    state.versions.current = tag;
    await this.writeState(state);
    await this.storage.writeVersions(state.versions);

    return {
      success: true,
      message: `Switched to version "${tag}"`,
    };
  }

  async deleteVersion(tag: string): Promise<CommandResult> {
    await this.ensureInstalled();

    const state = await this.readState();

    if (tag === state.versions.current) {
      return {
        success: false,
        message: `Cannot delete the current version "${tag}". Switch to another version first.`,
      };
    }

    const idx = state.versions.versions.findIndex(v => v.tag === tag);
    if (idx === -1) {
      return {
        success: false,
        message: `Version "${tag}" not found.`,
      };
    }

    state.versions.versions.splice(idx, 1);
    await this.writeState(state);
    await this.storage.writeVersions(state.versions);

    return {
      success: true,
      message: `Deleted version "${tag}"`,
    };
  }

  async getCurrentVersion(): Promise<string> {
    const state = await this.readState();
    return state.versions.current;
  }

  private async ensureInstalled(): Promise<void> {
    if (!(await this.storage.exists())) {
      await this.storage.init();
      this.invalidateCache();
    }
  }

  private async readState(): Promise<ManagerState> {
    if (this.stateCache) {
      return this.stateCache;
    }
    const state = await this.storage.readState();
    this.stateCache = state;
    return state;
  }

  private async writeState(state: ManagerState): Promise<void> {
    await this.storage.writeState(state);
    this.stateCache = state;
  }

  private invalidateCache(): void {
    this.stateCache = null;
  }

  private findConfig(state: ManagerState, nameOrId: string): MapgenConfig | undefined {
    return state.configs.find(c => c.name === nameOrId || c.id === nameOrId);
  }

  private findConfigIndex(state: ManagerState, nameOrId: string): number {
    return state.configs.findIndex(c => c.name === nameOrId || c.id === nameOrId);
  }

  private findConfigByName(state: ManagerState, name: string, excludeId?: string): boolean {
    return state.configs.some(c => c.name === name && c.id !== excludeId);
  }

  private findVersion(state: ManagerState, tag: string): VersionEntry | undefined {
    return state.versions.versions.find(v => v.tag === tag);
  }

  private sortConfigs(
    a: MapgenConfig,
    b: MapgenConfig,
    sortBy: ListFilter['sortBy'],
    sortDir: ListFilter['sortDir']
  ): number {
    const av = a[sortBy ?? 'updatedAt'];
    const bv = b[sortBy ?? 'updatedAt'];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
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
