export class BaseRenderer {
  constructor(options = {}) {
    this.type = options.type || 'unknown';
    this.width = options.width || 800;
    this.height = options.height || 600;
    this.canvas = options.canvas || null;
    this.context = null;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  render(state) {
    throw new Error(`Renderer ${this.type} must implement render()`);
  }

  clear() {
    if (this.context) {
      this.context.clearRect(0, 0, this.width, this.height);
    }
  }

  destroy() {
    this.canvas = null;
    this.context = null;
  }
}

export class WebGLRenderer extends BaseRenderer {
  constructor(options = {}) {
    super({ ...options, type: 'webgl' });
    this.gl = null;
    this.program = null;
    this.buffers = {};
  }

  initialize() {
    if (!this.canvas) {
      throw new Error('Canvas required for WebGL renderer');
    }
    
    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }
    
    this.context = this.gl;
    return this;
  }

  render(state) {
    if (!this.gl) {
      throw new Error('WebGL renderer not initialized');
    }
    
    // 清除画布
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    // 实际渲染逻辑将由子类实现
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + info);
    }
    
    return shader;
  }

  createProgram(vertexShader, fragmentShader) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Program link error: ' + info);
    }
    
    this.program = program;
    return program;
  }
}

export class Canvas2DRenderer extends BaseRenderer {
  constructor(options = {}) {
    super({ ...options, type: 'canvas2d' });
  }

  initialize() {
    if (!this.canvas) {
      throw new Error('Canvas required for Canvas2D renderer');
    }
    
    this.context = this.canvas.getContext('2d');
    if (!this.context) {
      throw new Error('Canvas2D context not supported');
    }
    
    return this;
  }

  render(state) {
    if (!this.context) {
      throw new Error('Canvas2D renderer not initialized');
    }
    
    // 清除画布
    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, this.width, this.height);
    
    // 实际渲染逻辑将由子类实现
  }

  drawImage(image, x, y, width, height) {
    if (!this.context) {
      throw new Error('Canvas2D renderer not initialized');
    }
    
    this.context.drawImage(image, x, y, width, height);
  }

  drawText(text, x, y, options = {}) {
    if (!this.context) {
      throw new Error('Canvas2D renderer not initialized');
    }
    
    this.context.font = options.font || '14px Arial';
    this.context.fillStyle = options.color || '#ffffff';
    this.context.fillText(text, x, y);
  }
}

export class RendererFactory {
  static create(type, options = {}) {
    switch (type) {
      case 'webgl':
        return new WebGLRenderer(options).initialize();
      case 'canvas2d':
        return new Canvas2DRenderer(options).initialize();
      default:
        throw new Error(`Unknown renderer type: ${type}`);
    }
  }

  static getAvailableRenderers() {
    const renderers = ['canvas2d'];
    
    // 检查 WebGL 支持
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (gl) {
        renderers.unshift('webgl');
      }
    }
    
    return renderers;
  }
}
