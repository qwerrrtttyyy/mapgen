// WebGL2 渲染器

import vertexSrc from './shaders/vertex.glsl?raw';
import fragmentSrc from './shaders/fragment.glsl?raw';
import { MapData } from '@/types';

export class WebGLRenderer {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  textures: Record<string, WebGLTexture> = {};
  selectMaskTexture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  private vao: WebGLVertexArrayObject;
  private uniformLocations: Record<string, WebGLUniformLocation> = {};
  private mapWidth = 0;
  private mapHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;

    // 编译着色器
    const vs = this.compileShader(gl.VERTEX_SHADER, vertexSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(this.program);
      console.error('Shader link failed:', info);
      throw new Error('Shader link failed: ' + info);
    }

    // 全屏四边形
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // 缓存 uniform 位置
    const numUniforms = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(this.program, i);
      if (info) {
        const loc = gl.getUniformLocation(this.program, info.name);
        if (loc) this.uniformLocations[info.name] = loc;
      }
    }

    // 创建纹理
    this.textures = {
      u_plateTex: this.createTexture(),
      u_elevTex: this.createTexture(),
      u_moistTex: this.createTexture(),
      u_riverTex: this.createTexture(),
      u_tempTex: this.createTexture(),
    };
    this.selectMaskTexture = this.createTexture();

    // 创建帧缓冲（用于导出）
    this.framebuffer = gl.createFramebuffer()!;

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // 检查浮点纹理支持
    const ext1 = gl.getExtension('EXT_color_buffer_float');
    const ext2 = gl.getExtension('OES_texture_float_linear');
    if (!ext1 || !ext2) {
      console.warn('Float texture extensions not fully supported. Using fallback.');
    }
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      console.error('Shader compile failed:', info);
      throw new Error('Shader compile failed: ' + info);
    }
    return s;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  uploadMapData(data: MapData) {
    const gl = this.gl;
    this.mapWidth = data.width;
    this.mapHeight = data.height;

    this.uploadTexture(this.textures.u_plateTex, data.plateTex, data.width, data.height);
    this.uploadTexture(this.textures.u_elevTex, data.elevTex, data.width, data.height);
    this.uploadTexture(this.textures.u_moistTex, data.moistTex, data.width, data.height);
    this.uploadTexture(this.textures.u_riverTex, data.riverTex, data.width, data.height);
    this.uploadTexture(this.textures.u_tempTex, data.tempTex, data.width, data.height);

    // 初始化选择掩码（256x1）
    const mask = new Uint8Array(256);
    gl.bindTexture(gl.TEXTURE_2D, this.selectMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 1, 0, gl.RED, gl.UNSIGNED_BYTE, mask);
  }

  private uploadTexture(tex: WebGLTexture, data: Float32Array, w: number, h: number) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // WebGL2 支持 RGBA32F，直接使用
    // 注意：某些环境可能不支持 RGBA32F，需要检查
    const ext1 = gl.getExtension('EXT_color_buffer_float');
    const ext2 = gl.getExtension('OES_texture_float_linear');
    if (ext1 && ext2) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    } else {
      // Fallback: 使用 RGBA8 并归一化数据
      const normalized = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        normalized[i] = Math.max(0, Math.min(255, (data[i] + 1.0) * 127.5));
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, normalized);
    }
  }

  updateSelectMask(selectedPlates: Set<number>) {
    const gl = this.gl;
    const mask = new Uint8Array(256);
    selectedPlates.forEach(id => {
      if (id >= 0 && id < 256) mask[id] = 255;
    });
    gl.bindTexture(gl.TEXTURE_2D, this.selectMaskTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RED, gl.UNSIGNED_BYTE, mask);
  }

  setUniform(name: string, value: number | number[] | boolean) {
    const gl = this.gl;
    const loc = this.uniformLocations[name];
    if (loc === undefined) return;
    if (typeof value === 'boolean') {
      gl.uniform1i(loc, value ? 1 : 0);
    } else if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
      else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
      else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
    }
  }

  render(params: Record<string, number | number[] | boolean>) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;

    // 只在尺寸变化时更新 viewport
    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.05, 0.05, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // 绑定纹理
    let texUnit = 0;
    for (const [name, tex] of Object.entries(this.textures)) {
      gl.activeTexture(gl.TEXTURE0 + texUnit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const loc = gl.getUniformLocation(this.program, name);
      if (loc) gl.uniform1i(loc, texUnit);
      texUnit++;
    }
    gl.activeTexture(gl.TEXTURE0 + texUnit);
    gl.bindTexture(gl.TEXTURE_2D, this.selectMaskTexture);
    const maskLoc = gl.getUniformLocation(this.program, 'u_selectMask');
    if (maskLoc) gl.uniform1i(maskLoc, texUnit);

    // 设置 uniforms
    this.setUniform('u_mapWidth', this.mapWidth);
    this.setUniform('u_mapHeight', this.mapHeight);
    this.setUniform('u_time', performance.now() * 0.001);

    for (const [key, value] of Object.entries(params)) {
      this.setUniform(key, value);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  exportImage(width: number, height: number, params: Record<string, number | number[] | boolean>): ImageData {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const prevWidth = canvas.width;
    const prevHeight = canvas.height;

    // 调整尺寸
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);

    this.render(params);

    const pixels = new Uint8ClampedArray(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // 恢复尺寸
    canvas.width = prevWidth;
    canvas.height = prevHeight;

    return new ImageData(pixels, width, height);
  }

  resize(width: number, height: number) {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}
