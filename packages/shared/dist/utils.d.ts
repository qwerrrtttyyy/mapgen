/**
 * 工具函数模块 - 公共辅助函数
 * @packageDocumentation
 */
/**
 * 平滑阶跃函数 - smoothstep 插值
 * @param edge0 - 下边缘
 * @param edge1 - 上边缘
 * @param x - 输入值
 * @returns 平滑插值结果 [0, 1]
 */
export declare function smoothstep(edge0: number, edge1: number, x: number): number;
/**
 * 线性插值
 * @param a - 起始值
 * @param b - 结束值
 * @param t - 插值因子 [0, 1]
 * @returns 插值结果
 */
export declare function lerp(a: number, b: number, t: number): number;
/**
 * 限制数值范围
 * @param value - 输入值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的值
 */
export declare function clamp(value: number, min: number, max: number): number;
/**
 * 将归一化值映射到范围
 * @param t - 归一化值 [0, 1]
 * @param min - 最小值
 * @param max - 最大值
 * @returns 映射后的值
 */
export declare function mapRange(t: number, min: number, max: number): number;
/**
 * 计算两点间欧氏距离
 * @param x1 - 点 1 X 坐标
 * @param y1 - 点 1 Y 坐标
 * @param x2 - 点 2 X 坐标
 * @param y2 - 点 2 Y 坐标
 * @returns 距离
 */
export declare function distance(x1: number, y1: number, x2: number, y2: number): number;
/**
 * 计算两点间平方距离（避免开方）
 * @param x1 - 点 1 X 坐标
 * @param y1 - 点 1 Y 坐标
 * @param x2 - 点 2 X 坐标
 * @param y2 - 点 2 Y 坐标
 * @returns 平方距离
 */
export declare function distanceSquared(x1: number, y1: number, x2: number, y2: number): number;
/**
 * 角度转弧度
 * @param degrees - 角度值
 * @returns 弧度值
 */
export declare function toRadians(degrees: number): number;
/**
 * 弧度转角度
 * @param radians - 弧度值
 * @returns 角度值
 */
export declare function toDegrees(radians: number): number;
/**
 * 标准化数组（归一化到 [0, 1]）
 * @param arr - 输入数组
 * @param out - 输出数组（可与输入相同）
 * @param offset - 输出偏移
 * @param scale - 缩放因子
 */
export declare function normalizeArray(arr: Float32Array | Uint8Array | Int32Array, out: Float32Array, offset?: number, scale?: number): void;
/**
 * 查找数组中的最大值索引
 * @param arr - 输入数组
 * @returns 最大值索引
 */
export declare function argMax(arr: number[] | Float32Array | Int32Array): number;
/**
 * 查找数组中的最小值索引
 * @param arr - 输入数组
 * @returns 最小值索引
 */
export declare function argMin(arr: number[] | Float32Array | Int32Array): number;
