/**
 * Mapgen Manager - Type Definitions
 */
import type { MapParams } from '@mapgen/core';

/** Mapgen configuration preset */
export interface MapgenConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
  /** Version tag */
  version: string;
  /** Map generation parameters */
  params: MapgenParams;
  /** User-defined metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Map generation parameters.
 *
 * 以 @mapgen/core 的 MapParams 为基础（type-only import，无运行时依赖），
 * 额外允许任意字符串键以兼容 CLI 用户传入的额外参数。
 * 这样 core 的 MapParams 字段增减会自动反映到 manager，避免类型漂移。
 */
export interface MapgenParams extends MapParams {
  [key: string]: unknown;
}

/** Version manifest stored in .mapgen/versions.json */
export interface VersionManifest {
  /** Current active version */
  current: string;
  /** Available versions with timestamps */
  versions: VersionEntry[];
}

/** Single version entry */
export interface VersionEntry {
  /** Version tag */
  tag: string;
  /** Timestamp when version was created */
  createdAt: number;
  /** Optional description */
  description?: string;
  /** Snapshot of configs at this version */
  configIds: string[];
}

/** State file stored in .mapgen/state.json */
export interface ManagerState {
  /** Schema version */
  schemaVersion: number;
  /** Initialization timestamp */
  initializedAt: number;
  /** Current mapgen version */
  mapgenVersion: string;
  /** All managed configs */
  configs: MapgenConfig[];
  /** Version tracking */
  versions: VersionManifest;
}

/** CLI command result */
export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

/** Options for creating a config */
export interface CreateConfigOptions {
  name: string;
  description?: string;
  params: MapgenParams;
  metadata?: Record<string, unknown>;
}

/** Options for updating a config */
export interface UpdateConfigOptions {
  name?: string;
  description?: string;
  params?: Partial<MapgenParams>;
  metadata?: Record<string, unknown>;
}

/** Filter options for listing configs */
export interface ListFilter {
  /** Search by name (substring match) */
  search?: string;
  /** Filter by version tag */
  version?: string;
  /** Sort field */
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
}
