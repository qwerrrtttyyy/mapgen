/**
 * @mapgen/manager - Map Generator Manager
 *
 * Provides installation, CRUD operations, and version management
 * for mapgen configurations stored in a .mapgen directory.
 */

export { MapgenManager } from './manager.js';
export { Storage } from './storage.js';
export type {
  MapgenConfig,
  MapgenParams,
  ManagerState,
  VersionManifest,
  VersionEntry,
  CommandResult,
  CreateConfigOptions,
  UpdateConfigOptions,
  ListFilter,
} from './types.js';
