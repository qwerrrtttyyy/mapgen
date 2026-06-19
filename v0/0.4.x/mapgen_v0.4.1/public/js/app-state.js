export class AppState {
  constructor(initialValues = {}) {
    this._state = { ...initialValues };
    this._initialValues = { ...initialValues };
    this._subscribers = new Set();
    this._batching = false;
    this._pendingChanges = new Map();
  }

  get(key, defaultValue) {
    if (key in this._state) {
      return this._state[key];
    }
    return defaultValue;
  }

  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;

    if (this._batching) {
      this._pendingChanges.set(key, { value, oldValue });
    } else {
      this._notifySubscribers(key, value, oldValue);
    }
  }

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  batch(fn) {
    this._batching = true;
    this._pendingChanges.clear();
    
    try {
      fn();
    } finally {
      this._batching = false;
      
      // 收集所有更改
      const changes = new Map(this._pendingChanges);
      this._pendingChanges.clear();
      
      // 触发一次批量通知
      this._notifyBatch(changes);
    }
  }

  reset() {
    this._state = { ...this._initialValues };
  }

  _notifySubscribers(key, value, oldValue) {
    for (const subscriber of this._subscribers) {
      try {
        subscriber(key, value, oldValue);
      } catch (err) {
        console.error('AppState subscriber error:', err);
      }
    }
  }

  _notifyBatch(changes) {
    // 触发一个特殊的批量通知事件
    for (const subscriber of this._subscribers) {
      try {
        subscriber('__batch__', changes);
      } catch (err) {
        console.error('AppState subscriber error:', err);
      }
    }
  }

  // 获取所有状态的快照
  getState() {
    return { ...this._state };
  }

  // 批量设置多个值
  setMany(values) {
    this.batch(() => {
      for (const [key, value] of Object.entries(values)) {
        this.set(key, value);
      }
    });
  }

  // 监听特定 key 的变化
  onChange(key, callback) {
    return this.subscribe((changedKey, value, oldValue) => {
      if (changedKey === key) {
        callback(value, oldValue);
      }
    });
  }
}
