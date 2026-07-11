/**
 * @module editor/commandStack
 * 撤销/重做栈：Command 模式 + max=50 限制
 *
 * 从 editor.ts 拆分（P2-3）。每个 Command 记录 affected pixels 的 before/after，
 * 支持精确的像素级回滚。
 */

export interface Command {
  readonly kind: string;
  undo(): void;
  redo(): void;
}

/**
 * 撤销/重做栈。max=50（BR-3）。新编辑清空 redo 栈。
 */
export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly max: number;

  constructor(max: number = 50) {
    this.max = max;
  }

  push(cmd: Command): void {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.max) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.redo();
    this.undoStack.push(cmd);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get undoDepth(): number {
    return this.undoStack.length;
  }
  get redoDepth(): number {
    return this.redoStack.length;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
