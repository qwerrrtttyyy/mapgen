import type { MapData } from '@mapgen/core';
import type { RenderParams, UniformValue } from './renderParams.js';
import { bus } from '../core/eventBus.js';

export type { RenderParams } from './renderParams.js';

let drawCallCount = 0;

export function getDrawCallCount(): number {
  return drawCallCount;
}

export function resetDrawCallCount(): void {
  drawCallCount = 0;
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private textures: Record<string, WebGLTexture> = {};
  private uniformLoc: Record<string, WebGLUniformLocation> = {};
  private debugMode: boolean = false;
  private wireframeMode: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
  }

  initShaders(fragSrc: string): void {
    const gl = this.gl;
    const vs = this._compile(
      gl.VERTEX_SHADER,
      `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`
    );
    const fs = this._compile(gl.FRAGMENT_SHADER, fragSrc);
    const prog = gl.createProgram();
    if (!prog) throw new Error('Failed to create program');

    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Shader link: ' + gl.getProgramInfoLog(prog));
    }

    this.program = prog;
    gl.useProgram(prog);

    const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) {
        const loc = gl.getUniformLocation(prog, info.name);
        if (loc) this.uniformLoc[info.name] = loc;
      }
    }

    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('Failed to create buffer');

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    this.vao = gl.createVertexArray();
    if (!this.vao) throw new Error('Failed to create VAO');

    gl.bindVertexArray(this.vao);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.textures = {
      u_plateTex: this._createTex(),
      u_elevTex: this._createTex(),
      u_moistureTex: this._createTex(),
      u_tempTex: this._createTex(),
      u_riverTex: this._createTex(),
      u_currentTex: this._createTex(),
      u_iceTex: this._createTex(),
      u_selectionMaskTex: this._createTex(),
      u_trailTex: this._createTex(),
    };

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  private _compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type);
    if (!s) throw new Error('Failed to create shader');

    gl.shaderSource(s, src);
    gl.compileShader(s);

    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  private _createTex(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  uploadMapData(data: MapData): void {
    const gl = this.gl;
    this.mapWidth = data.width;
    this.mapHeight = data.height;

    const texNames = ['u_plateTex', 'u_elevTex', 'u_moistureTex', 'u_riverTex', 'u_tempTex'];
    const texData = [data.plateTex, data.elevTex, data.moistTex, data.riverTex, data.tempTex];

    const floatExt = gl.getExtension('EXT_color_buffer_float');
    const floatLinearExt = gl.getExtension('OES_texture_float_linear');
    const useFloat = floatExt && floatLinearExt;

    for (let i = 0; i < texNames.length; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[texNames[i]]);
      if (useFloat) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA32F,
          data.width,
          data.height,
          0,
          gl.RGBA,
          gl.FLOAT,
          texData[i]
        );
      } else {
        const norm = WebGLRenderer._normalizeToUint8(texData[i]);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          data.width,
          data.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          norm
        );
      }
    }

    // 世界式生成纹理（可选，缺省零纹理避免采样未定义数据）
    const empty = new Float32Array(data.width * data.height * 4);
    const currentData = data.currentTex ?? empty;
    const iceData = data.iceTex ?? empty;
    const worldTex: Array<[string, Float32Array]> = [
      ['u_currentTex', currentData],
      ['u_iceTex', iceData],
    ];
    for (const [name, arr] of worldTex) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[name]);
      if (useFloat) {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA32F,
          data.width,
          data.height,
          0,
          gl.RGBA,
          gl.FLOAT,
          arr
        );
      } else {
        const norm = WebGLRenderer._normalizeToUint8(arr);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          data.width,
          data.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          norm
        );
      }
    }

    const selMask = new Uint8Array(256);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.u_selectionMaskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 1, 0, gl.RED, gl.UNSIGNED_BYTE, selMask);
  }

  private static _normalizeToUint8(src: Float32Array): Uint8Array {
    const out = new Uint8Array(src.length);
    for (let j = 0; j < src.length; j++) {
      out[j] = Math.max(0, Math.min(255, (src[j] + 1.0) * 127.5));
    }
    return out;
  }

  updateSelectMask(selected: number[]): void {
    const gl = this.gl;
    const mask = new Uint8Array(256);
    selected.forEach(id => {
      if (id >= 0 && id < 256) mask[id] = 255;
    });
    gl.bindTexture(gl.TEXTURE_2D, this.textures.u_selectionMaskTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RED, gl.UNSIGNED_BYTE, mask);
  }

  updateTrailTex(data: { width: number; height: number; pixels: Uint8Array } | null): void {
    const gl = this.gl;
    if (!data) return;
    gl.bindTexture(gl.TEXTURE_2D, this.textures.u_trailTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      data.width,
      data.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data.pixels
    );
  }

  // shader 中声明为 int 的 uniform（其余 number 均为 float，开关为 float 非 bool）
  private static readonly INT_UNIFORMS = new Set([
    'u_style',
    'u_fbmOctaves',
    'u_selectedCount',
    'u_plateTotal',
  ]);

  setUniform(name: string, value: UniformValue): void {
    const gl = this.gl;
    const loc = this.uniformLoc[name];
    if (loc === undefined) return;

    // shader 开关声明为 float，必须用 uniform1f 而非 uniform1i
    if (typeof value === 'boolean') {
      gl.uniform1f(loc, value ? 1.0 : 0.0);
    } else if (typeof value === 'number') {
      if (WebGLRenderer.INT_UNIFORMS.has(name)) gl.uniform1i(loc, Math.round(value));
      else gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
      else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
      else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
    }
  }

  render(params: RenderParams): void {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;

    gl.viewport(0, 0, w, h);
    gl.clearColor(0.05, 0.05, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!this.program || !this.vao) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    let texUnit = 0;
    for (const [name, tex] of Object.entries(this.textures)) {
      gl.activeTexture(gl.TEXTURE0 + texUnit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const loc = this.uniformLoc[name];
      if (loc !== undefined) gl.uniform1i(loc, texUnit);
      texUnit++;
    }

    this.setUniform('u_resolution', [w, h]);
    this.setUniform('u_time', performance.now() * 0.001);
    this.setUniform('u_debugMode', this.debugMode ? 1.0 : 0.0);
    this.setUniform('u_wireframeMode', this.wireframeMode ? 1.0 : 0.0);
    this.setUniform('u_mapSize', [this.mapWidth, this.mapHeight]);

    for (const [key, value] of Object.entries(params) as Array<[string, UniformValue]>) {
      this.setUniform(key, value);
    }

    if (this.wireframeMode) {
      (gl as unknown as { polygonMode: (face: number, mode: number) => void }).polygonMode(
        gl.FRONT_AND_BACK,
        0x1b01
      );
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawCallCount++;

    gl.bindVertexArray(null);

    if (this.wireframeMode) {
      (gl as unknown as { polygonMode: (face: number, mode: number) => void }).polygonMode(
        gl.FRONT_AND_BACK,
        0x1b02
      );
    }

    bus.emit('render.frame', {
      drawCalls: drawCallCount,
      textureCount: Object.keys(this.textures).length,
    });
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  destroy(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    for (const tex of Object.values(this.textures)) gl.deleteTexture(tex);
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  setWireframeMode(enabled: boolean): void {
    this.wireframeMode = enabled;
  }

  getDebugInfo(): { textures: number; width: number; height: number; programs: number } {
    return {
      textures: Object.keys(this.textures).length,
      width: this.mapWidth,
      height: this.mapHeight,
      programs: this.program ? 1 : 0,
    };
  }
}
