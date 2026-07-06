#!/usr/bin/env node

/**
 * Mapgen Manager - CLI Entry Point
 * Usage: mapgen <command> [options]
 */

import { MapgenManager } from './manager.js';
import type {
  CreateConfigOptions,
  UpdateConfigOptions,
  ListFilter,
  MapgenParams,
} from './types.js';

const manager = new MapgenManager();

function print(result: { success: boolean; message: string; data?: unknown }): void {
  if (result.success) {
    console.log(`✓ ${result.message}`);
  } else {
    console.error(`✗ ${result.message}`);
  }
  if (result.data) {
    console.log(JSON.stringify(result.data, null, 2));
  }
  if (!result.success) {
    process.exit(1);
  }
}

function printTable(items: Record<string, unknown>[], columns: string[]): void {
  if (items.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const item of items) {
    const parts = columns.map(col => `${col}=${String(item[col] ?? '')}`);
    console.log(`  ${parts.join('  |  ')}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  switch (command) {
    case 'init':
      print(await manager.init());
      break;

    case 'install':
      print(await manager.install());
      break;

    case 'create': {
      const name = args[1];
      if (!name) {
        console.error(
          '✗ Usage: mapgen create <name> [--desc <description>] [--seed <seed>] [--plates <n>] [--landmass <0-1>] [--noise <type>] [--fbm <type>]'
        );
        process.exit(1);
      }
      const opts: CreateConfigOptions = {
        name,
        description: getArg(args, '--desc'),
        params: parseParams(args),
      };
      print(await manager.createConfig(opts));
      break;
    }

    case 'read': {
      const nameOrId = args[1];
      if (!nameOrId) {
        console.error('✗ Usage: mapgen read <name-or-id>');
        process.exit(1);
      }
      print(await manager.readConfig(nameOrId));
      break;
    }

    case 'list':
    case 'ls': {
      const filter: ListFilter = {
        search: getArg(args, '--search'),
        version: getArg(args, '--version'),
        sortBy: getArg(args, '--sort') as ListFilter['sortBy'],
        sortDir: getArg(args, '--dir') as ListFilter['sortDir'],
      };
      const result = await manager.listConfigs(filter);
      if (result.success) {
        console.log(`✓ ${result.message}`);
        printTable(result.data as Record<string, unknown>[], ['name', 'version', 'updatedAt']);
      } else {
        print(result);
      }
      break;
    }

    case 'update': {
      const nameOrId = args[1];
      if (!nameOrId) {
        console.error(
          '✗ Usage: mapgen update <name-or-id> [--name <new-name>] [--desc <description>] [--seed <seed>] [--plates <n>] [--landmass <0-1>]'
        );
        process.exit(1);
      }
      const updates: UpdateConfigOptions = {};
      const newName = getArg(args, '--name');
      if (newName) updates.name = newName;
      const desc = getArg(args, '--desc');
      if (desc) updates.description = desc;
      const params = parseParamsPartial(args);
      if (Object.keys(params).length > 0) updates.params = params;
      print(await manager.updateConfig(nameOrId, updates));
      break;
    }

    case 'delete':
    case 'rm': {
      const nameOrId = args[1];
      if (!nameOrId) {
        console.error('✗ Usage: mapgen delete <name-or-id>');
        process.exit(1);
      }
      print(await manager.deleteConfig(nameOrId));
      break;
    }

    case 'version':
    case 'ver': {
      const sub = args[1];
      switch (sub) {
        case 'list':
        case 'ls':
        case undefined: {
          const result = await manager.listVersions();
          if (result.success) {
            console.log(`✓ ${result.message}`);
            const data = result.data as {
              versions: { tag: string; createdAt: number; description?: string }[];
            };
            for (const v of data.versions) {
              const marker = v.tag === (result.data as { current: string }).current ? ' *' : '';
              console.log(
                `  ${v.tag}${marker}  (${new Date(v.createdAt).toISOString()})${v.description ? `  - ${v.description}` : ''}`
              );
            }
          } else {
            print(result);
          }
          break;
        }
        case 'create': {
          const tag = args[2];
          if (!tag) {
            console.error('✗ Usage: mapgen version create <tag> [--desc <description>]');
            process.exit(1);
          }
          const description = getArg(args, '--desc');
          print(await manager.createVersion(tag, description));
          break;
        }
        case 'use': {
          const tag = args[2];
          if (!tag) {
            console.error('✗ Usage: mapgen version use <tag>');
            process.exit(1);
          }
          print(await manager.useVersion(tag));
          break;
        }
        case 'delete':
        case 'rm': {
          const tag = args[2];
          if (!tag) {
            console.error('✗ Usage: mapgen version delete <tag>');
            process.exit(1);
          }
          print(await manager.deleteVersion(tag));
          break;
        }
        default:
          console.error(`✗ Unknown version subcommand: ${sub}`);
          console.error('  Available: list, create, use, delete');
          process.exit(1);
      }
      break;
    }

    default:
      console.error(`✗ Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
mapgen - Map Generator Manager CLI

Usage: mapgen <command> [options]

Commands:
  init                          Initialize .mapgen directory
  install                       Install or update mapgen

  create <name>                 Create a new config
    --desc <description>          Description
    --seed <seed>                 Seed string
    --plates <n>                  Plate count
    --landmass <0-1>              Landmass ratio
    --noise <type>                Noise type (perlin, simplex, value, worley)
    --fbm <type>                  FBM type (standard, ridged, billowy, warped)

  read <name-or-id>             Read a config
  list [--search <q>]           List configs
    --version <tag>               Filter by version
    --sort <field>                Sort by (name, createdAt, updatedAt)
    --dir <asc|desc>              Sort direction

  update <name-or-id>           Update a config
    --name <new-name>             Rename
    --desc <description>          New description
    --seed, --plates, etc.        Update params

  delete <name-or-id>           Delete a config

  version                       Version management
    list                          List all versions
    create <tag> [--desc <desc>]  Create a new version snapshot
    use <tag>                     Switch to a version
    delete <tag>                  Delete a version (not current)

Examples:
  mapgen init
  mapgen create my-map --seed "hello" --plates 12 --landmass 0.6
  mapgen list
  mapgen version create v1.0 --desc "First release"
  mapgen version use v1.0
`);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function parseParams(args: string[]): MapgenParams {
  const size = getArg(args, '--size');
  const width = getArg(args, '--width');
  const height = getArg(args, '--height');
  return {
    seedStr: getArg(args, '--seed') ?? 'default',
    plateCount: parseInt(getArg(args, '--plates') ?? '10', 10),
    landmass: parseFloat(getArg(args, '--landmass') ?? '0.5'),
    noiseType: getArg(args, '--noise') ?? 'perlin',
    fbmType: getArg(args, '--fbm') ?? 'standard',
    mapAspect: getArg(args, '--aspect'),
    mapSize: size ? parseInt(size, 10) : undefined,
    mapWidth: width ? parseInt(width, 10) : undefined,
    mapHeight: height ? parseInt(height, 10) : undefined,
  };
}

function parseParamsPartial(args: string[]): Partial<MapgenParams> {
  const params: Partial<MapgenParams> = {};
  const seed = getArg(args, '--seed');
  if (seed) params.seedStr = seed;
  const plates = getArg(args, '--plates');
  if (plates) params.plateCount = parseInt(plates, 10);
  const landmass = getArg(args, '--landmass');
  if (landmass) params.landmass = parseFloat(landmass);
  const noise = getArg(args, '--noise');
  if (noise) params.noiseType = noise;
  const fbm = getArg(args, '--fbm');
  if (fbm) params.fbmType = fbm;
  return params;
}

main().catch(err => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
