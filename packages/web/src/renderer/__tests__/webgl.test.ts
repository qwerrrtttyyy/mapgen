import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebGLRenderer } from '../webgl.js';
import type { RenderParams } from '../renderParams.js';

const TEX_NAMES = ['u_plateTex', 'u_elevTex', 'u_moistureTex', 'u_riverTex', 'u_tempTex', 'u_selectionMaskTex', 'u_trailTex'];
const ACTIVE_UNIFORM_NAMES = [
  ...TEX_NAMES,
  'u_style', 'u_seaLevel', 'u_showBoundaries', 'u_boundaryColor',
  'u_resolution', 'u_time',
];

function createMockGL() {
  const uniformCalls: { method: string; args: unknown[] }[] = [];
  const createdTextures: WebGLTexture[] = [];
  let texCounter = 0;

  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    ARRAY_BUFFER: 0x8892,
    TRIANGLE_STRIP: 0x0005,
    COLOR_BUFFER_BIT: 0x00004000,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    LINEAR: 0x2601,
    CLAMP_TO_EDGE: 0x812f,
    RGBA32F: 0x8814,
    RGBA: 0x1908,
    R8: 0x8229,
    RED: 0x1903,
    FLOAT: 0x1406,
    UNSIGNED_BYTE: 0x1401,
    STATIC_DRAW: 0x88e4,
    FLOAT_VEC2: 0x8b50,
    FLOAT_VEC3: 0x8b51,
    FLOAT_VEC4: 0x8b52,
    INT: 0x1404,
    LINK_STATUS: 0x8b82,
    COMPILE_STATUS: 0x8b81,
    ACTIVE_UNIFORMS: 0x8b86,

    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((_, param: number) => {
      if (param === 0x8b82) return true;
      if (param === 0x8b86) return ACTIVE_UNIFORM_NAMES.length;
      return true;
    }),
    getProgramInfoLog: vi.fn(() => ''),
    getShaderInfoLog: vi.fn(() => ''),
    useProgram: vi.fn(),
    getActiveUniform: vi.fn((_prog, index: number) => ({
      name: ACTIVE_UNIFORM_NAMES[index],
      type: 0x1406,
      size: 1,
    })),
    getUniformLocation: vi.fn((_prog, name: string) => ({ name } as unknown as WebGLUniformLocation)),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    createTexture: vi.fn(() => {
      const t = { id: ++texCounter } as unknown as WebGLTexture;
      createdTextures.push(t);
      return t;
    }),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    texSubImage2D: vi.fn(),
    activeTexture: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    drawArrays: vi.fn(),
    disable: vi.fn(),
    getExtension: vi.fn(() => ({
      // EXT_color_buffer_float / OES_texture_float_linear marker
    })),
    deleteProgram: vi.fn(),
    deleteTexture: vi.fn(),

    uniform1i: vi.fn((loc: WebGLUniformLocation, v: number) => {
      uniformCalls.push({ method: 'uniform1i', args: [(loc as unknown as { name: string }).name, v] });
    }),
    uniform1f: vi.fn((loc: WebGLUniformLocation, v: number) => {
      uniformCalls.push({ method: 'uniform1f', args: [(loc as unknown as { name: string }).name, v] });
    }),
    uniform2f: vi.fn((loc: WebGLUniformLocation, a: number, b: number) => {
      uniformCalls.push({ method: 'uniform2f', args: [(loc as unknown as { name: string }).name, a, b] });
    }),
    uniform3f: vi.fn((loc: WebGLUniformLocation, a: number, b: number, c: number) => {
      uniformCalls.push({ method: 'uniform3f', args: [(loc as unknown as { name: string }).name, a, b, c] });
    }),
    uniform4f: vi.fn((loc: WebGLUniformLocation, a: number, b: number, c: number, d: number) => {
      uniformCalls.push({ method: 'uniform4f', args: [(loc as unknown as { name: string }).name, a, b, c, d] });
    }),
  };

  return { gl, uniformCalls, createdTextures };
}

function createMockCanvas(gl: ReturnType<typeof createMockGL>['gl']) {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(gl as unknown as WebGL2RenderingContext);
  return canvas;
}

async function initRenderer(gl: ReturnType<typeof createMockGL>['gl']) {
  const canvas = createMockCanvas(gl);
  const renderer = new WebGLRenderer(canvas);
  await renderer.initShaders('#version 300 es\nvoid main(){}');
  return renderer;
}

describe('WebGLRenderer batch uniform updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets multiple uniforms in a single call', async () => {
    const { gl, uniformCalls } = createMockGL();
    const renderer = await initRenderer(gl);

    renderer.setUniforms({
      u_style: 2,
      u_seaLevel: 0.45,
      u_showBoundaries: true,
      u_boundaryColor: [0.1, 0.2, 0.3],
    });

    const styleCalls = uniformCalls.filter(c => c.args[0] === 'u_style');
    const seaCalls = uniformCalls.filter(c => c.args[0] === 'u_seaLevel');
    const boundCalls = uniformCalls.filter(c => c.args[0] === 'u_showBoundaries');
    const colorCalls = uniformCalls.filter(c => c.args[0] === 'u_boundaryColor');

    expect(styleCalls).toHaveLength(1);
    expect(styleCalls[0].method).toBe('uniform1i');
    expect(styleCalls[0].args[1]).toBe(2);

    expect(seaCalls).toHaveLength(1);
    expect(seaCalls[0].method).toBe('uniform1f');
    expect(seaCalls[0].args[1]).toBeCloseTo(0.45);

    expect(boundCalls).toHaveLength(1);
    expect(boundCalls[0].method).toBe('uniform1f');
    expect(boundCalls[0].args[1]).toBe(1);

    expect(colorCalls).toHaveLength(1);
    expect(colorCalls[0].method).toBe('uniform3f');
    expect(colorCalls[0].args.slice(1)).toEqual([0.1, 0.2, 0.3]);
  });

  it('skips unchanged uniforms when setting same values again', async () => {
    const { gl, uniformCalls } = createMockGL();
    const renderer = await initRenderer(gl);

    const params: RenderParams = { u_seaLevel: 0.45, u_style: 2 };
    renderer.setUniforms(params);
    const afterFirst = uniformCalls.length;

    renderer.setUniforms(params);
    expect(uniformCalls.length).toBe(afterFirst);
  });

  it('only updates uniforms that changed in subsequent calls', async () => {
    const { gl, uniformCalls } = createMockGL();
    const renderer = await initRenderer(gl);

    renderer.setUniforms({ u_seaLevel: 0.45, u_style: 2 });
    const firstSeaCalls = uniformCalls.filter(c => c.args[0] === 'u_seaLevel').length;
    const firstStyleCalls = uniformCalls.filter(c => c.args[0] === 'u_style').length;

    renderer.setUniforms({ u_seaLevel: 0.55, u_style: 2 });
    const secondSeaCalls = uniformCalls.filter(c => c.args[0] === 'u_seaLevel').length;
    const secondStyleCalls = uniformCalls.filter(c => c.args[0] === 'u_style').length;

    expect(firstSeaCalls).toBe(1);
    expect(secondSeaCalls).toBe(2);
    expect(firstStyleCalls).toBe(1);
    expect(secondStyleCalls).toBe(1);
  });

  it('sets resolution and time during render', async () => {
    const { gl, uniformCalls } = createMockGL();
    const renderer = await initRenderer(gl);
    renderer.resize(800, 600);

    renderer.render({});

    const resolutionCalls = uniformCalls.filter(c => c.args[0] === 'u_resolution');
    const timeCalls = uniformCalls.filter(c => c.args[0] === 'u_time');

    expect(resolutionCalls).toHaveLength(1);
    expect(resolutionCalls[0].method).toBe('uniform2f');
    expect(resolutionCalls[0].args.slice(1)).toEqual([800, 600]);

    expect(timeCalls).toHaveLength(1);
    expect(timeCalls[0].method).toBe('uniform1f');
    expect(typeof timeCalls[0].args[1]).toBe('number');
  });

  it('binds texture samplers to stable units every frame', async () => {
    const { gl, uniformCalls } = createMockGL();
    const renderer = await initRenderer(gl);

    renderer.render({});

    const texSamplerCalls = uniformCalls.filter(c => TEX_NAMES.includes(c.args[0] as string));
    expect(texSamplerCalls).toHaveLength(TEX_NAMES.length);
    texSamplerCalls.forEach((call, i) => {
      expect(call.method).toBe('uniform1i');
      expect(call.args[1]).toBe(i);
    });
  });
});
