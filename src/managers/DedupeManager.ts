import type { AxiosRequestConfig } from 'axios';
import type {
  DedupeConfig,
  DedupeItem,
  DedupeContext,
  DedupeShortcut,
} from '../types';
import { BaseManager } from './base/BaseManager';
import { normalizeGenerateKey } from '../utils/requestKey';

/**
 * 防重复提交管理器
 * 在指定时间窗口内，相同的请求只会被发送一次
 *
 * 功能：
 * 1. 支持配置时间窗口
 * 2. 支持配置需要去重的方法
 * 3. 支持自定义生成请求 key
 * 4. 自动管理定时器，防止资源泄漏
 *
 * @example
 * ```typescript
 * const dedupeManager = new DedupeManager({
 *   enabled: true,
 *   timeWindow: 1000,
 *   methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
 *   generateKey: 'method:url:data.id', // 使用 method、url 和 data.id 生成 key
 * });
 *
 * // 使用简写
 * const dedupeManager2 = new DedupeManager(true); // 启用，使用默认配置
 * const dedupeManager3 = new DedupeManager(['POST', 'PUT']); // 启用，设置去重方法
 * const dedupeManager4 = new DedupeManager('method:url'); // 启用，设置生成 key 的方式
 * ```
 */
export class DedupeManager extends BaseManager<DedupeConfig, DedupeContext> {
  /** 管理器名称 */
  protected readonly managerName: string = 'DedupeManager';

  /** 默认去重方法（静态属性，避免在父类构造函数中访问时未初始化） */
  private static readonly defaultMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  /**
   * 规范化配置（静态方法，供外部调用）
   * @param config - 用户提供的配置（可能是简写）
   * @returns { enabled: boolean, config?: Partial<DedupeConfig> }
   */
  static normalize(config?: DedupeShortcut | null): { enabled: boolean; config?: Partial<DedupeConfig> } {
    if (config === undefined || config === null) {
      return { enabled: true }; // 默认开启
    }
    if (config === false) {
      return { enabled: false };
    }
    if (config === true) {
      return { enabled: true, config: { enabled: true } };
    }
    if (Array.isArray(config)) {
      return { enabled: true, config: { enabled: true, methods: config.map(m => String(m).toUpperCase()) } };
    }
    if (typeof config === 'string') {
      return { enabled: true, config: { enabled: true, generateKey: config } };
    }
    if (typeof config === 'function') {
      return { enabled: true, config: { enabled: true, generateKey: config } };
    }
    return { enabled: true, config: { ...config, methods: config.methods?.map((m: string) => m.toUpperCase()) } };
  }

  /** 待处理的请求 Map */
  private pendingRequests: Map<string, DedupeItem> = new Map();

  /**
   * 构造函数
   * @param config - 防重复提交配置（支持简写）
   */
  constructor(config: DedupeShortcut = {}) {
    const { config: normalizedConfig } = DedupeManager.normalize(config);
    super(normalizedConfig || {});
  }

  /**
   * 获取默认配置
   * @returns 默认配置
   */
  protected getDefaultConfig(): DedupeConfig {
    return {
      enabled: true,
      timeWindow: 1000,
      methods: [...DedupeManager.defaultMethods],
      generateKey: 'method:url',
    };
  }

  /**
   * 创建请求上下文
   * @param override - 请求级别的配置覆盖（可选）
   * @returns 请求上下文
   *
   * @example
   * ```typescript
   * // 使用默认配置
   * const context = dedupeManager.createContext();
   *
   * // 覆盖部分配置
   * const context = dedupeManager.createContext({
   *   timeWindow: 2000,
   *   methods: ['POST'],
   * });
   * ```
   */
  createContext(override?: Partial<DedupeConfig>): DedupeContext {
    const config = this.mergeConfig(override || {});
    return {
      enabled: config.enabled!,
      timeWindow: config.timeWindow!,
      methods: config.methods!,
      generateKey: normalizeGenerateKey(config.generateKey),
    };
  }

  /**
   * 检查是否应该处理该请求
   * @param context - 请求上下文
   * @param config - Axios 请求配置
   * @returns 是否应该去重
   */
  shouldDedupe(context: DedupeContext, config: AxiosRequestConfig): boolean {
    if (!context.enabled) return false;
    const method = (config.method || 'get').toUpperCase();
    return context.methods.includes(method);
  }

  /**
   * 检查是否重复并处理
   * @param context - 请求上下文
   * @param config - Axios 请求配置
   * @param makeRequest - 发起请求的函数
   * @returns Promise，解析为请求结果
   */
  async dedupe<T>(
    context: DedupeContext,
    config: AxiosRequestConfig,
    makeRequest: () => Promise<T>
  ): Promise<T> {
    const key = context.generateKey(config);

    // 检查是否已有相同的请求
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    // 创建定时器，在时间窗口后自动清理
    const timer = setTimeout(() => {
      this.pendingRequests.delete(key);
    }, context.timeWindow);

    // 发起请求
    const promise = new Promise<T>((resolve, reject) => {
      makeRequest()
        .then((result) => {
          clearTimeout(timer);
          this.pendingRequests.delete(key);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          this.pendingRequests.delete(key);
          reject(error);
        });
    });

    // 保存到待处理请求 Map
    this.pendingRequests.set(key, { timer, promise, resolve: () => {}, reject: () => {} });

    return promise;
  }

  /**
   * 清除所有待处理的请求
   * 清理所有定时器
   */
  clear(): void {
    this.pendingRequests.forEach((item) => clearTimeout(item.timer));
    this.pendingRequests.clear();
  }

  /**
   * 销毁管理器，清理所有资源
   * 应该在实例销毁时调用
   */
  destroy(): void {
    this.clear();
  }
}

