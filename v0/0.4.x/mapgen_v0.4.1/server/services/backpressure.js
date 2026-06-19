export class BackpressureController {
  constructor(config = {}) {
    this.highWaterMark = config.highWaterMark || 100;
    this.lowWaterMark = config.lowWaterMark || 10;
    this.paused = false;
    this.pendingMessages = 0;
  }

  // 检查是否应该暂停
  shouldPause() {
    return this.pendingMessages >= this.highWaterMark;
  }

  // 检查是否应该恢复
  shouldResume() {
    return this.paused && this.pendingMessages <= this.lowWaterMark;
  }

  // 暂停
  pause() {
    this.paused = true;
    console.log(`[Backpressure] Paused`);
  }

  // 恢复
  resume() {
    this.paused = false;
    console.log(`[Backpressure] Resumed`);
  }

  // 增加待处理消息
  increment() {
    this.pendingMessages++;
    
    if (this.shouldPause()) {
      this.pause();
    }
  }

  // 减少待处理消息
  decrement() {
    this.pendingMessages--;
    
    if (this.shouldResume()) {
      this.resume();
    }
  }

  // 获取状态
  getStatus() {
    return {
      paused: this.paused,
      pendingMessages: this.pendingMessages,
      highWaterMark: this.highWaterMark,
      lowWaterMark: this.lowWaterMark,
    };
  }
}
