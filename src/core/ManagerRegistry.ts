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
import type { DedupeConfig } from '../types';
import type { CancelConfig } from '../types';
import type { RetryConfig } from '../types';

/**
 * 管理器注册表
 * 负责管理实例级和请求级管理器的生命周期
 *
 * 设计原则：
 * 1. 实例级管理器具优先：有实例级配置就用实例级
 * 2. 没有实例级配置时，按需创建私有级管理器
 * 3. 私有级管理器按类型缓存，每个类型只创建一次，后续复用
 * 4. 配置合并时不修改原配置
 *
 * 生命周期：
 * - 实例级管理器在 AxiosRequest 实例化时根据配置创建
 * - 私有级管理器在首次需要时创建，后续复用
 * - destroy() 时清理所有资源
 *
 * @example
 * ```typescript
 * // 场景1：实例级有配置 → 用实例级
 * const request = new AxiosRequest({
 *   token: { refreshToken, setToken },
 *   dedupe: true,
 * });
 * // tokenManager 和 dedupeManager 都是实例级
 *
 * // 场景2：实例级没有 + 请求级有 → 用私有级
 * const request = new AxiosRequest({});
 * request.get('/api', { retry: true });
 * // retryManager 是私有级，第一次创建后缓存
 *
 * // 场景3：都没有 → 不使用（返回禁用状态的管理器）
 * const request = new AxiosRequest({});
 * // dedupeManager/cancelManager/retryManager 都返回禁用状态
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

  /** 实例级防重复提交管理（有实例配置时创建） */
  private instanceDedupeManager?: DedupeManager;

  /** 实例级请求取消管理（有实例配置时创建） */
  private instanceCancelManager?: CancelManager;

  /** 实例级请求重试管理（有实例配置时创建） */
  private instanceRetryManager?: RetryManager;

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

    // 只有显式配置了 dedupe 才创建实例级管理器
    if (config.dedupe !== undefined) {
      this.instanceDedupeManager = new DedupeManager(this.normalizeDedupeConfig(config.dedupe));
    }

    // 只有显式配置了 cancel 才创建实例级管理器
    if (config.cancel !== undefined) {
      this.instanceCancelManager = new CancelManager(this.normalizeCancelConfig(config.cancel));
    }

    // 只有显式配置了 retry 才创建实例级管理器
    if (config.retry !== undefined) {
      this.instanceRetryManager = new RetryManager(this.normalizeRetryConfig(config.retry));
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
   * 2. 没有实例级，但请求配置了（true 或对象），创建/获取私有级
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
   * 1. 有实例级管理，优先使用
   * 2. 没有实例级，请求级有配置，创建/获取私有级
   * 3. 都没有，返回禁用状态的管理器
   */
  getDedupeManager(requestConfig?: DedupeShortcut): DedupeManager | undefined {
    // 有实例级管理，优先使用
    if (this.instanceDedupeManager) {
      return this.instanceDedupeManager;
    }

    // 没有实例级，请求级有配置
    if (requestConfig !== undefined) {
      // 首次使用时创建私有级管理器
      if (!this.privateDedupeManager) {
        this.privateDedupeManager = new DedupeManager(this.normalizeDedupeConfig(requestConfig));
      }
      return this.privateDedupeManager;
    }

    // 都没有，返回 undefined
    return undefined;
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
   *
   * 规则：
   * 1. 有实例级管理，优先使用
   * 2. 没有实例级，请求级有配置，创建/获取私有级
   * 3. 都没有，返回 undefined
   */
  getCancelManager(requestConfig?: CancelShortcut): CancelManager | undefined {
    // 有实例级管理，优先使用
    if (this.instanceCancelManager) {
      return this.instanceCancelManager;
    }

    // 没有实例级，请求级有配置
    if (requestConfig !== undefined) {
      // 首次使用时创建私有级管理器
      if (!this.privateCancelManager) {
        this.privateCancelManager = new CancelManager(this.normalizeCancelConfig(requestConfig));
      }
      return this.privateCancelManager;
    }

    // 都没有，返回 undefined
    return undefined;
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
   *
   * 规则：
   * 1. 有实例级管理，优先使用
   * 2. 没有实例级，请求级有配置，创建/获取私有级
   * 3. 都没有，返回 undefined
   */
  getRetryManager(requestConfig?: RetryShortcut): RetryManager | undefined {
    // 有实例级管理，优先使用
    if (this.instanceRetryManager) {
      return this.instanceRetryManager;
    }

    // 没有实例级，请求级有配置
    if (requestConfig !== undefined) {
      // 首次使用时创建私有级管理器
      if (!this.privateRetryManager) {
        this.privateRetryManager = new RetryManager(this.normalizeRetryConfig(requestConfig));
      }
      return this.privateRetryManager;
    }

    // 都没有，返回 undefined
    return undefined;
  }

  /**
   * 规范化请求重试配置
   */
  private normalizeRetryConfig(config: RetryShortcut): RetryConfig {
    if (config === true) return { enabled: true, maxRetries: 3 };
    if (config === false) return { enabled: false };
    if (typeof config === 'number') return { enabled: true, maxRetries: config };
    if (typeof config === 'function') return { enabled: true, retryCondition: config };
    return { enabled: true, ...config } as RetryConfig;
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
