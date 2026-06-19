import { writeFile, readFile } from 'fs/promises';

export class EventStore {
  constructor(config) {
    this.config = config;
    this.events = [];
    this.maxEvents = config.maxEvents || 10000;
    this.storagePath = config.storagePath || './events.json';
  }

  // 初始化存储
  async init() {
    try {
      const content = await readFile(this.storagePath, 'utf-8');
      this.events = JSON.parse(content);
    } catch (err) {
      this.events = [];
    }
  }

  // 存储事件
  async store(event) {
    const eventWithMeta = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
      stored: true,
    };

    this.events.push(eventWithMeta);

    // 限制内存中的事件数量
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // 异步持久化到文件
    await this.persist();

    return eventWithMeta;
  }

  // 获取事件
  getEvent(eventId) {
    return this.events.find(e => e.id === eventId);
  }

  // 获取事件历史
  getHistory(options = {}) {
    const { event, since, limit = 100 } = options;
    
    let filtered = this.events;

    if (event) {
      filtered = filtered.filter(e => e.type === event);
    }

    if (since) {
      filtered = filtered.filter(e => e.timestamp >= since);
    }

    return filtered.slice(-limit);
  }

  // 重放事件
  async replay(options = {}) {
    const { since, event } = options;
    const events = this.getHistory({ since, event });
    
    for (const event of events) {
      console.log(`[EventStore] Replaying: ${event.type}`);
    }

    return events.length;
  }

  // 持久化到文件
  async persist() {
    try {
      const data = JSON.stringify(this.events, null, 2);
      await writeFile(this.storagePath, data, 'utf-8');
    } catch (err) {
      console.error('[EventStore] Persist error:', err);
    }
  }

  // 清除旧事件
  async cleanup(maxAge = 86400000) { // 默认 24 小时
    const cutoff = Date.now() - maxAge;
    this.events = this.events.filter(e => e.timestamp > cutoff);
    await this.persist();
  }

  // 生成事件 ID
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取统计信息
  getStats() {
    return {
      totalEvents: this.events.length,
      oldestEvent: this.events[0]?.timestamp,
      newestEvent: this.events[this.events.length - 1]?.timestamp,
    };
  }
}
