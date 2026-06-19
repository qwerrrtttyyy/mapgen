export class EventSubscription {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.subscriptions = new Map();
  }

  // 订阅事件
  subscribe(channel, event, handler, filter = null) {
    const subscriptionId = this.generateId();
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Map());
    }
    
    this.subscriptions.get(channel).set(subscriptionId, {
      event,
      handler,
      filter,
      createdAt: Date.now(),
    });

    // 注册到事件总线
    this.eventBus.on(event, (data) => {
      this.dispatchEvent(channel, event, data);
    });

    console.log(`[EventSubscription] Subscribed: ${channel}/${event}`);
    return subscriptionId;
  }

  // 取消订阅
  unsubscribe(subscriptionId) {
    for (const [channel, subs] of this.subscriptions) {
      if (subs.has(subscriptionId)) {
        subs.delete(subscriptionId);
        console.log(`[EventSubscription] Unsubscribed: ${subscriptionId}`);
        return true;
      }
    }
    return false;
  }

  // 分发事件
  dispatchEvent(channel, event, data) {
    const subs = this.subscriptions.get(channel);
    if (!subs) return;

    for (const [, subscription] of subs) {
      if (subscription.event !== event) continue;
      
      // 应用过滤器
      if (subscription.filter && !subscription.filter(data)) {
        continue;
      }

      try {
        subscription.handler(data);
      } catch (err) {
        console.error(`[EventSubscription] Handler error:`, err);
      }
    }
  }

  // 获取订阅统计
  getStats() {
    let totalSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscriptions += subs.size;
    }
    return {
      channels: this.subscriptions.size,
      totalSubscriptions,
    };
  }

  // 生成订阅 ID
  generateId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
