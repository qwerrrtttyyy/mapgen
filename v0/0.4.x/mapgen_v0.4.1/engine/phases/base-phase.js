export class BasePhase {
  constructor(name, weight = 1) {
    this.name = name;
    this.weight = weight;
    this.startTime = null;
    this.endTime = null;
  }

  // 执行阶段（子类必须实现）
  async execute(context) {
    throw new Error(`Phase ${this.name} must implement execute()`);
  }

  // 验证输入
  validate(input) {
    return true;
  }

  // 包装执行（带计时和事件）
  async wrappedExecute(context) {
    this.startTime = Date.now();
    
    // 发送阶段开始事件
    context.emit('phase:start', { 
      phase: this.name, 
      weight: this.weight 
    });

    try {
      // 验证输入
      if (!this.validate(context)) {
        throw new Error(`Phase ${this.name}: invalid input`);
      }

      // 执行阶段
      const result = await this.execute(context);
      
      this.endTime = Date.now();
      
      // 发送阶段完成事件
      context.emit('phase:complete', {
        phase: this.name,
        duration: this.endTime - this.startTime,
        result,
      });

      return result;
    } catch (err) {
      this.endTime = Date.now();
      
      // 发送阶段错误事件
      context.emit('phase:error', {
        phase: this.name,
        error: err.message,
        duration: this.endTime - this.startTime,
      });

      throw err;
    }
  }
}
