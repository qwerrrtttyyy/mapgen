import { describe, it, expect, vi } from 'vitest';
import { RenderLoop } from '../renderLoop.js';

describe('RenderLoop', () => {
  it('renders only once per frame even with multiple requests', () => {
    const renderFn = vi.fn();
    const loop = new RenderLoop(renderFn);

    let frameId = 0;
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return ++frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    loop.requestRender();
    loop.requestRender();
    loop.requestRender();

    expect(callbacks.length).toBe(1);
    callbacks[0](performance.now());
    expect(renderFn).toHaveBeenCalledTimes(1);

    loop.stop();
    vi.unstubAllGlobals();
  });

  it('restarts after stop when render is requested', () => {
    const renderFn = vi.fn();
    const loop = new RenderLoop(renderFn);

    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    loop.start();
    loop.stop();
    loop.requestRender();
    expect(callbacks.length).toBe(2); // start twice

    loop.stop();
    vi.unstubAllGlobals();
  });
});
