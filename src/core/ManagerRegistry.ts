import {
  AxiosRequestInstanceConfig,
  TokenManagerConfig,
  DedupeShortcut,
  CancelShortcut,
  RetryShortcut,
  TokenContext,
  DedupeContext,
  CancelContext,
  RetryContext,
} from '../types';
import { TokenManager } from '../managers/TokenManager';
import { DedupeManager } from '../managers/DedupeManager';
import { CancelManager } from '../managers/CancelManager';
import { RetryManager } from '../managers/RetryManager';
import { mergeConfig } from '../utils/configMerger';

/**
 * 管理器注册表
 * 负责管理实例级和请求级管理器的生命周期
 *
 * 功能：
 * 1. 管理实例级管理器的创建和销毁
 * 2. 缓存请求级管理器（按配置复用）
 * 3. 提供统一的管理器获取接口
 *
 * 设计原则：
 * - 实例级管理器具优先
 * - 请求级管理器按配置缓存复用
 * - 配置合并时不修改原配置
 *
 * @example
 * ```typescript
 * const registry = new ManagerRegistry({
 *   token: tokenConfig, // 实例级 Token 管理
 *   dedupe: true, // 实例级防重复提交（默认开启）
 *   cancel: true, // 实例级请求取消（默认开启）
 *   retry: false, // 实例级重试（默认关闭）
 * });
 *
 * // 获取实例级管理
 * const dedupeManager = registry.getDedupeManager();
 *
 * // 获取请求级管理（会缓存）
 * const retryManager = registry.getRetryManager({ enabled: true, maxRetries: 3 });
 * ```
 */
export class ManagerRegistry {
  /** 实例级 Token 管理 */
  private tokenManager?: TokenManager;

  /** 实例级防重复提交管理 */
  private dedupeManager: DedupeManager;

  /** 实例级请求取消管理 */
  private cancelManager: CancelManager;

  /** 实例级请求重试管理 */
  private retryManager: RetryManager;

  /** 请求级管理缓存（按配置哈希） */
  private requestLevelCache: Map<string, TokenManager | DedupeManager | CancelManager | RetryManager> = new Map();

  /**
   * 构造函数
   * @param config - 实例配置
   */
  constructor(config: AxiosRequestInstanceConfig) {
    // 创建实例级管理
    if (config.token) {
      this.tokenManager = new TokenManager(config.token);
    }

    this.dedupeManager = new DedupeManager(config.dedupe ?? { enabled: true });
    this.cancelManager = new CancelManager(config.cancel ?? { enabled: true });
    this.retryManager = new RetryManager(config.retry ?? { enabled: false });
  }

  // ==================== Token 管理 ====================

  /**
   * 获取 Token 管理
   * @param requestConfig - 请求级配置（可选）
   * @returns Token 管理实例或 undefined
   *
   * 规则：
   * 1. 如果有实例级 Token 管理，优先使用
   * 2. 如果请求配置了 Token 管理，创建/获取请求级管理
   * 3. 请求级配置为 false 时，返回 undefined
   */
  getTokenManager(requestConfig?: TokenManagerConfig | boolean): TokenManager | undefined {
    // 请求级配置为 false，禁用 Token 管理
    if (requestConfig === false) {
      return undefined;
    }

    // 有实例级管理，优先使用
    if (this.tokenManager) {
      // 如果请求级有配置，需要合并
      if (typeof requestConfig === 'object' && requestConfig !== true) {
        // 创建合并后的请求级管理（缓存）
        return this.getOrCreateRequestLevelTokenManager(requestConfig);
      }
      return this.tokenManager;
    }

    // 没有实例级管理，但请求级有配置
    if (requestConfig === true || typeof requestConfig === 'object') {
      const config = requestConfig === true ? {} : requestConfig;
      return this.getOrCreateRequestLevelTokenManager(config);
    }

    return undefined;
  }

  /**
   * 创建或获取请求级 Token 管理（带缓存）
   * @param config - Token 管理配置
   * @returns Token 管理实例
   */
  private getOrCreateRequestLevelTokenManager(config: TokenManagerConfig): TokenManager {
    const cacheKey = this.generateCacheKey('token', config);
    let manager = this.requestLevelCache.get(cacheKey) as TokenManager | undefined;

    if (!manager) {
      manager = new TokenManager(config);
      this.requestLevelCache.set(cacheKey, manager);
    }

    return manager;
  }

  // ==================== 防重复提交管理 ====================

  /**
   * 获取防重复提交管理
   * @param requestConfig - 请求级配置（可选）
   * @returns 防重复提交管理实例
   */
  getDedupeManager(requestConfig?: DedupeShortcut): DedupeManager {
    // 有实例级管理，优先使用
    if (requestConfig === undefined || requestConfig === false) {
      return this.dedupeManager;
    }

    // 请求级有配置，创建/获取请求级管理
    const normalizedConfig = this.normalizeDedupeConfig(requestConfig);
    return this.getOrCreateRequestLevelDedupeManager(normalizedConfig);
  }

  /**
   * 创建或获取请求级防重复提交管理（带缓存）
   * @param config - 防重复提交配置
   * @returns 防重复提交管理实例
   */
  private getOrCreateRequestLevelDedupeManager(config: Record<string, any>): DedupeManager {
    const cacheKey = this.generateCacheKey('dedupe', config);
    let manager = this.requestLevelCache.get(cacheKey) as DedupeManager | undefined;

    if (!manager) {
      manager = new DedupeManager(config);
      this.requestLevelCache.set(cacheKey, manager);
    }

    return manager;
  }

  /**
   * 规范化防重复提交配置
   * @param config - 配置（可能是简写）
   * @returns 标准化后的配置
   */
  private normalizeDedupeConfig(config: DedupeShortcut): Record<string, any> {
    if (config === true) return { enabled: true };
    if (Array.isArray(config)) return { enabled: true, methods: config };
    if (typeof config === 'string') return { enabled: true, generateKey: config };
    if (typeof config === 'function') return { enabled: true, generateKey: config };
    return config as Record<string, any>;
  }

  // ==================== 请求取消管理 ====================

  /**
   * 获取请求取消管理
   * @param requestConfig - 请求级配置（可选）
   * @returns 请求取消管理实例
   */
  getCancelManager(requestConfig?: CancelShortcut): CancelManager {
    // 有实例级管理，优先使用
    if (requestConfig === undefined || requestConfig === false) {
      return this.cancelManager;
    }

    // 请求级有配置，创建/获取请求级管理
    const normalizedConfig = this.normalizeCancelConfig(requestConfig);
    return this.getOrCreateRequestLevelCancelManager(normalizedConfig);
  }

  /**
   * 创建或获取请求级请求取消管理（带缓存）
   * @param config - 请求取消配置
   * @returns 请求取消管理实例
   */
  private getOrCreateRequestLevelCancelManager(config: Record<string, any>): CancelManager {
    const cacheKey = this.generateCacheKey('cancel', config);
    let manager = this.requestLevelCache.get(cacheKey) as CancelManager | undefined;

    if (!manager) {
      manager = new CancelManager(config);
      this.requestLevelCache.set(cacheKey, manager);
    }

    return manager;
  }

  /**
   * 规范化请求取消配置
   * @param config - 配置（可能是简写）
   * @returns 标准化后的配置
   */
  private normalizeCancelConfig(config: CancelShortcut): Record<string, any> {
    if (config === true) return { enabled: true };
    if (Array.isArray(config)) return { enabled: true, methods: config };
    if (typeof config === 'string') return { enabled: true, generateKey: config };
    if (typeof config === 'function') return { enabled: true, generateKey: config };
    return config as Record<string, any>;
  }

  // ==================== 请求重试管理 ====================

  /**
   * 获取请求重试管理
   * @param requestConfig - 请求级配置（可选）
   * @returns 请求重试管理实例
   */
  getRetryManager(requestConfig?: RetryShortcut): RetryManager {
    // 有实例级管理，优先使用
    if (requestConfig === undefined || requestConfig === false) {
      return this.retryManager;
    }

    // 请求级有配置，创建/获取请求级管理
    const normalizedConfig = this.normalizeRetryConfig(requestConfig);
    return this.getOrCreateRequestLevelRetryManager(normalizedConfig);
  }

  /**
   * 创建或获取请求级请求重试管理（带缓存）
   * @param config - 请求重试配置
   * @returns 请求重试管理实例
   */
  private getOrCreateRequestLevelRetryManager(config: Record<string, any>): RetryManager {
    const cacheKey = this.generateCacheKey('retry', config);
    let manager = this.requestLevelCache.get(cacheKey) as RetryManager | undefined;

    if (!manager) {
      manager = new RetryManager(config);
      this.requestLevelCache.set(cacheKey, manager);
    }

    return manager;
  }

  /**
   * 规范化请求重试配置
   * @param config - 配置（可能是简写）
   * @returns 标准化后的配置
   */
  private normalizeRetryConfig(config: RetryShortcut): Record<string, any> {
    if (config === true) return { enabled: true };
    if (typeof config === 'number') return { enabled: true, maxRetries: config };
    if (typeof config === 'function') return { enabled: true, retryCondition: config };
    return config as Record<string, any>;
  }

  // ==================== 上下文创建 ====================

  /**
   * 创建 Token 上下文
   * @param manager - Token 管理实例
   * @param getToken - 请求级 token 获取函数（可选）
   * @param whitelistUrls - 请求级白名单 URL（可选）
   * @returns Token 上下文
   */
  createTokenContext(
    manager: TokenManager,
    getToken?: () => string | null,
    whitelistUrls?: (string | RegExp)[]
  ): TokenContext {
    return manager.createContext(getToken, whitelistUrls);
  }

  /**
   * 创建防重复提交上下文
   * @param manager - 防重复提交管理实例
   * @param override - 请求级配置覆盖（可选）
   * @returns 防重复提交上下文
   */
  createDedupeContext(manager: DedupeManager, override?: any): DedupeContext {
    return manager.createContext(override);
  }

  /**
   * 创建请求取消上下文
   * @param manager - 请求取消管理实例
   * @param override - 请求级配置覆盖（可选）
   * @returns 请求取消上下文
   */
  createCancelContext(manager: CancelManager, override?: any): CancelContext {
    return manager.createContext(override);
  }

  /**
   * 创建请求重试上下文
   * @param manager - 请求重试管理实例
   * @param override - 请求级配置覆盖（可选）
   * @returns 请求重试上下文
   */
  createRetryContext(manager: RetryManager, override?: any): RetryContext {
    return manager.createContext(override);
  }

  // ==================== 工具方法 ====================

  /**
   * 生成配置缓存 key
   * @param type - 管理类型
   * @param config - 配置对象
   * @returns 缓存 key
   */
  private generateCacheKey(type: string, config: Record<string, any>): string {
    // 使用 JSON.stringify 生成唯一 key（需要排序 key）
    const sortedConfig = this.sortObjectKeys(config);
    return `${type}:${JSON.stringify(sortedConfig)}`;
  }

  /**
   * 对对象 key 进行排序（保证相同对象生成相同的 key）
   * @param obj - 任意对象
   * @returns 排序后的对象
   */
  private sortObjectKeys(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    if (obj !== null && typeof obj === 'object' && !(obj instanceof RegExp) && !(obj instanceof Function)) {
      return Object.keys(obj)
        .sort()
        .reduce((result: any, key) => {
          result[key] = this.sortObjectKeys(obj[key]);
          return result;
        }, {});
    }

    return obj;
  }

  // ==================== 资源管理 ====================

  /**
   * 销毁所有管理，清理所有资源
   * 应该在 AxiosRequest 实例销毁时调用
   */
  destroy(): void {
    // 销毁实例级管理
    this.tokenManager?.destroy();
    this.dedupeManager.destroy();
    this.cancelManager.destroy();
    this.retryManager.destroy();

    // 销毁请求级管理
    this.requestLevelCache.forEach((manager) => {
      manager.destroy();
    });
    this.requestLevelCache.clear();
  }
}
