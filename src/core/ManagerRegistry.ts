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

/**
 * 管理器注册表
 * 负责管理实例级和请求级管理器的生命周期
 *
 * 设计原则：
 * 1. 实例级管理器具优先（有实例级配置就用实例级）
 * 2. 没有实例级配置时，使用私有级管理器
 * 3. 私有级管理器按类型缓存，每个类型只创建一次，后续复用
 * 4. 配置合并时不修改原配置
 *
 * 生命周期：
 * - 私有级管理器在首次需要时创建
 * - 后续请求复用同一个私有级管理器实例
 * - destroy() 时清理所有资源
 *
 * @example
 * ```typescript
 * // 实例化时配置了 dedupe，使用实例级
 * const request = new AxiosRequest({
 *   dedupe: true,
 * });
 *
 * // 实例化时没有配置 dedupe，单个请求配置了，创建私有级并缓存
 * request.get('/api', { dedupe: true });
 *
 * // 后续请求也配置 dedupe，复用同一个私有级管理器
 * request.post('/api2', { dedupe: true });
 * ```
 */
export class ManagerRegistry {
  /** 实例级 Token 管理（有显式配置时创建） */
  private instanceTokenManager?: TokenManager;

  /** 私有级 Token 管理（首次需要时创建，后续复用） */
  private privateTokenManager?: TokenManager;

  /** 私有级防重复提交管理（首次需要时创建，后续复用） */
  private privateDedupeManager?: DedupeManager;

  /** 私有级请求取消管理（首次需要时创建，后续复用） */
  private privateCancelManager?: CancelManager;

  /** 私有级请求重试管理（首次需要时创建，后续复用） */
  private privateRetryManager?: RetryManager;

  /** 实例配置引用 */
  private config: AxiosRequestInstanceConfig;

  /**
   * 构造函数
   * @param config - 实例配置
   */
  constructor(config: AxiosRequestInstanceConfig) {
    this.config = config;

    // 只有显式配置了 token 才创建实例级管理器
    if (config.token) {
      this.instanceTokenManager = new TokenManager(config.token);
    }
  }

  // ==================== Token 管理 ====================

  /**
   * 获取 Token 管理
   * @param requestConfig - 请求级配置（可选）
   * @returns Token 管理实例或 undefined
   *
   * 规则：
   * 1. 有实例级管理，优先使用
   * 2. 没有实例级，但请求配置了（true 或对象），使用/创建私有级
   * 3. 请求级配置为 false，返回 undefined
   */
  getTokenManager(requestConfig?: TokenManagerConfig | boolean): TokenManager | undefined {
    // 请求级配置为 false，禁用 Token 管理
    if (requestConfig === false) {
      return undefined;
    }

    // 有实例级管理，优先使用
    if (this.instanceTokenManager) {
      return this.instanceTokenManager;
    }

    // 没有实例级，请求级配置了（true 或对象）
    if (requestConfig === true || typeof requestConfig === 'object') {
      // 首次使用时创建私有级管理器
      if (!this.privateTokenManager) {
        const config = requestConfig === true ? {} : requestConfig;
        this.privateTokenManager = new TokenManager(config);
      }
      return this.privateTokenManager;
    }

    return undefined;
  }

  /**
   * 获取 Token 私有级管理器（如果存在）
   * 用于检查是否已有私有级管理器
   */
  getPrivateTokenManager(): TokenManager | undefined {
    return this.privateTokenManager;
  }

  // ==================== 防重复提交管理 ====================

  /**
   * 获取防重复提交管理
   * @param requestConfig - 请求级配置（可选）
   * @returns 防重复提交管理实例
   *
   * 规则：
   * 1. 有实例级配置，创建实例级管理并使用
   * 2. 没有实例级，请求配置了，创建/获取私有级管理
   * 3. 都没有，返回默认启用的私有级管理
   */
  getDedupeManager(requestConfig?: DedupeShortcut): DedupeManager {
    // 有实例级配置，创建实例级管理
    if (this.config.dedupe !== undefined) {
      if (!this.instanceDedupeManager) {
        this.instanceDedupeManager = new DedupeManager(this.normalizeDedupeConfig(this.config.dedupe));
      }
      return this.instanceDedupeManager;
    }

    // 请求级有配置，创建/获取私有级管理
    if (requestConfig !== undefined) {
      return this.getOrCreatePrivateDedupeManager(this.normalizeDedupeConfig(requestConfig));
    }

    // 都没有，返回默认启用的私有级管理
    return this.getOrCreatePrivateDedupeManager({ enabled: true });
  }

  /** 实例级防重复提交管理（延迟创建） */
  private instanceDedupeManager?: DedupeManager;

  /**
   * 获取或创建私有级防重复提交管理
   */
  private getOrCreatePrivateDedupeManager(config: Partial<DedupeConfig>): DedupeManager {
    if (!this.privateDedupeManager) {
      this.privateDedupeManager = new DedupeManager(config as DedupeConfig);
    }
    return this.privateDedupeManager;
  }

  /**
   * 规范化防重复提交配置
   */
  private normalizeDedupeConfig(config: DedupeShortcut): DedupeConfig {
    if (config === true) return { enabled: true };
    if (config === false) return { enabled: false };
    if (Array.isArray(config)) return { enabled: true, methods: config };
    if (typeof config === 'string') return { enabled: true, generateKey: config };
    if (typeof config === 'function') return { enabled: true, generateKey: config };
    return { enabled: true, ...config } as DedupeConfig;
  }

  // ==================== 请求取消管理 ====================

  /**
   * 获取请求取消管理
   * @param requestConfig - 请求级配置（可选）
   * @returns 请求取消管理实例
   */
  getCancelManager(requestConfig?: CancelShortcut): CancelManager {
    // 有实例级配置，创建实例级管理
    if (this.config.cancel !== undefined) {
      if (!this.instanceCancelManager) {
        this.instanceCancelManager = new CancelManager(this.normalizeCancelConfig(this.config.cancel));
      }
      return this.instanceCancelManager;
    }

    // 请求级有配置，创建/获取私有级管理
    if (requestConfig !== undefined) {
      return this.getOrCreatePrivateCancelManager(this.normalizeCancelConfig(requestConfig));
    }

    // 都没有，返回默认启用的私有级管理
    return this.getOrCreatePrivateCancelManager({ enabled: true });
  }

  /** 实例级请求取消管理（延迟创建） */
  private instanceCancelManager?: CancelManager;

  /**
   * 获取或创建私有级请求取消管理
   */
  private getOrCreatePrivateCancelManager(config: Partial<CancelConfig>): CancelManager {
    if (!this.privateCancelManager) {
      this.privateCancelManager = new CancelManager(config as CancelConfig);
    }
    return this.privateCancelManager;
  }

  /**
   * 规范化请求取消配置
   */
  private normalizeCancelConfig(config: CancelShortcut): CancelConfig {
    if (config === true) return { enabled: true };
    if (config === false) return { enabled: false };
    if (Array.isArray(config)) return { enabled: true, methods: config };
    if (typeof config === 'string') return { enabled: true, generateKey: config };
    if (typeof config === 'function') return { enabled: true, generateKey: config };
    return { enabled: true, ...config } as CancelConfig;
  }

  // ==================== 请求重试管理 ====================

  /**
   * 获取请求重试管理
   * @param requestConfig - 请求级配置（可选）
   * @returns 请求重试管理实例
   */
  getRetryManager(requestConfig?: RetryShortcut): RetryManager {
    // 有实例级配置，创建实例级管理
    if (this.config.retry !== undefined) {
      if (!this.instanceRetryManager) {
        this.instanceRetryManager = new RetryManager(this.normalizeRetryConfig(this.config.retry));
      }
      return this.instanceRetryManager;
    }

    // 请求级有配置，创建/获取私有级管理
    if (requestConfig !== undefined) {
      return this.getOrCreatePrivateRetryManager(this.normalizeRetryConfig(requestConfig));
    }

    // 都没有，返回默认关闭的私有级管理
    return this.getOrCreatePrivateRetryManager({ enabled: false });
  }

  /** 实例级请求重试管理（延迟创建） */
  private instanceRetryManager?: RetryManager;

  /**
   * 获取或创建私有级请求重试管理
   */
  private getOrCreatePrivateRetryManager(config: Partial<RetryConfig>): RetryManager {
    if (!this.privateRetryManager) {
      this.privateRetryManager = new RetryManager(config as RetryConfig);
    }
    return this.privateRetryManager;
  }

  /**
   * 规范化请求重试配置
   */
  private normalizeRetryConfig(config: RetryShortcut): RetryConfig {
    if (config === true) return { enabled: true, maxRetries: 3 };
    if (config === false) return { enabled: false };
    if (typeof config === 'number') return { enabled: true, maxRetries: config };
    if (typeof config === 'function') return { enabled: true, retryCondition: config };
    return { enabled: false, ...config } as RetryConfig;
  }

  // ==================== 上下文创建 ====================

  /**
   * 创建 Token 上下文
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
   */
  createDedupeContext(manager: DedupeManager, override?: Partial<DedupeContext>): DedupeContext {
    return manager.createContext(override);
  }

  /**
   * 创建请求取消上下文
   */
  createCancelContext(manager: CancelManager, override?: Partial<CancelContext>): CancelContext {
    return manager.createContext(override);
  }

  /**
   * 创建请求重试上下文
   */
  createRetryContext(manager: RetryManager, override?: Partial<RetryContext>): RetryContext {
    return manager.createContext(override);
  }

  // ==================== 资源管理 ====================

  /**
   * 销毁所有管理，清理所有资源
   * 应该在 AxiosRequest 实例销毁时调用
   */
  destroy(): void {
    // 销毁实例级管理
    this.instanceTokenManager?.destroy();
    this.instanceDedupeManager?.destroy();
    this.instanceCancelManager?.destroy();
    this.instanceRetryManager?.destroy();

    // 销毁私有级管理
    this.privateTokenManager?.destroy();
    this.privateDedupeManager?.destroy();
    this.privateCancelManager?.destroy();
    this.privateRetryManager?.destroy();
  }
}

// 类型导入（确保类型可用）
import type { DedupeConfig } from '../types';
import type { CancelConfig } from '../types';
import type { RetryConfig } from '../types';
