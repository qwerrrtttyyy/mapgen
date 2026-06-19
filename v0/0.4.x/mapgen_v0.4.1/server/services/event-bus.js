import { EventEmitter } from 'events';

export class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.eventHistory = [];
    this.maxHistory = 1000;
  }

  // 带日志的事件触发
  emit(event, data) {
    console.log(`[EventBus] ${event}`, data);
    
    // 记录事件历史
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now(),
    });
    
    // 限制历史记录大小
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }
    
    return super.emit(event, data);
  }

  // 异步事件触发
  async emitAsync(event, data) {
    const listeners = this.listeners(event);
    for (const listener of listeners) {
      await listener(data);
    }
  }

  // 获取事件历史
  getHistory(event = null, limit = 100) {
    let history = this.eventHistory;
    
    if (event) {
      history = history.filter(h => h.event === event);
    }
    
    return history.slice(-limit);
  }

  // 清除历史
  clearHistory() {
    this.eventHistory = [];
  }
}
