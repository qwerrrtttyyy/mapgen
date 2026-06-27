import { describe, it, expect, beforeEach } from 'vitest';
import { loadRecentSeeds, saveRecentSeed } from '../launcher.js';

describe('recent seeds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadRecentSeeds returns an empty array when nothing is stored', () => {
    expect(loadRecentSeeds()).toEqual([]);
  });

  it('saveRecentSeed then loadRecentSeeds returns the seed', () => {
    saveRecentSeed('12345');
    expect(loadRecentSeeds()).toEqual(['12345']);
  });

  it('keeps at most 5 seeds, evicting the oldest', () => {
    saveRecentSeed('1');
    saveRecentSeed('2');
    saveRecentSeed('3');
    saveRecentSeed('4');
    saveRecentSeed('5');
    saveRecentSeed('6');
    expect(loadRecentSeeds()).toEqual(['6', '5', '4', '3', '2']);
  });

  it('moves a duplicate seed to the front without duplication', () => {
    saveRecentSeed('a');
    saveRecentSeed('b');
    saveRecentSeed('c');
    saveRecentSeed('a');
    expect(loadRecentSeeds()).toEqual(['a', 'c', 'b']);
  });

  it('ignores empty seed strings', () => {
    saveRecentSeed('');
    expect(loadRecentSeeds()).toEqual([]);
  });

  it('survives corrupted storage and returns an empty array', () => {
    localStorage.setItem('mapgen:recentSeeds', '{not valid json');
    expect(loadRecentSeeds()).toEqual([]);
  });
});
