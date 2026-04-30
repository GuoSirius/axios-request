/**
 * 管理器注册表
 *
 * 统一管理所有功能管理器，支持实例级和私有级两种模式。
 *
 * 核心规则：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 1. Token：默认关闭，需要显式配置才能开启                       │
 * │ 2. Dedupe/Cancel：默认开启，可显式配置为 false 关闭          │
 * │ 3. Retry：默认关闭，需要显式配置才能开启                      │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 优先级逻辑：
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ 有实例级管理器 → 请求默认用它（除非显式禁用）                        │
 * │ 无实例级管理器 → 只有请求显式要求才创建私有管理器                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * | 场景                           | Token | Dedupe | Cancel | Retry |
 * |--------------------------------|-------|--------|--------|-------|
 * | 有实例级 + 请求无配置            | 实例级 | 实例级 | 实例级 | 实例级 |
 * | 有实例级 + 请求显式禁用          | 不使用 | 不使用 | 不使用 | 不使用 |
 * | 无实例级 + 请求有配置           | 私有级 | 私有级 | 私有级 | 私有级 |
 * | 无实例级 + 请求无配置           | 不使用 | 不使用 | 不使用 | 不使用 |
 *
 * @example
 * // 实例级管理器：实例化时配置
 * const api = new AxiosRequest({
 *   dedupe: true,
 *   cancel: true,
 *   retry: { enabled: true, maxRetries: 3 },
 * });
 *
 * // 私有级管理器：按需创建并缓存复用
 * const api = new AxiosRequest({});
 * api.get('/test', { retry: true });  // 创建私有级 retryManager
 * api.get('/test2', { retry: true }); // 复用同一个私有级 retryManager
 */

import type {
  TokenManager as ITokenManager,
  DedupeManager as IDedupeManager,
  CancelManager as ICancelManager,
  RetryManager as IRetryManager,
} from '../types';
import type {
  AxiosRequestConfigExtended,
  TokenManagerConfig,
  DedupeConfig,
  CancelConfig,
  RetryConfig,
  DedupeShortcut,
  CancelShortcut,
  RetryShortcut,
} from '../types';
import { TokenManager } from '../managers/TokenManager';
import { DedupeManager } from '../managers/DedupeManager';
import { CancelManager } from '../managers/CancelManager';
import { RetryManager } from '../managers/RetryManager';

/**
 * 配置解析结果
 */
type ResolvedConfig = {
  token?: Partial<TokenManagerConfig> | boolean;
  dedupe?: DedupeShortcut;
  cancel?: CancelShortcut;
  retry?: RetryShortcut;
};

export default class ManagerRegistry {
  // ==================== 实例级管理器（构造函数时确定） ====================
  
  private readonly tokenManager?: ITokenManager;
  private readonly dedupeManager?: IDedupeManager;
  private readonly cancelManager?: ICancelManager;
  private readonly retryManager?: IRetryManager;
  
  // ==================== 私有级管理器（按需创建并缓存） ====================
  
  private _privateTokenManager?: ITokenManager;
  private _privateDedupeManager?: IDedupeManager;
  private _privateCancelManager?: ICancelManager;
  private _privateRetryManager?: IRetryManager;
  
  // ==================== 配置解析 ====================
  
  private readonly resolvedConfig: ResolvedConfig;
  
  constructor(config: AxiosRequestConfigExtended = {}) {
    // 保存原始配置
    this.resolvedConfig = {
      token: config.token,
      dedupe: config.dedupe,
      cancel: config.cancel,
      retry: config.retry,
    };

    // Token：默认关闭，显式配置才开启
    const tokenResult = TokenManager.normalize(config.token);
    if (tokenResult.enabled) {
      this.tokenManager = new TokenManager(tokenResult.config || undefined);
    }

    // Dedupe：实例级默认启用（传入 true 作为默认值）
    const dedupeResult = DedupeManager.normalize(config.dedupe, true);
    if (dedupeResult.enabled) {
      this.dedupeManager = new DedupeManager(dedupeResult.config || undefined);
    }

    // Cancel：实例级默认启用（传入 true 作为默认值）
    const cancelResult = CancelManager.normalize(config.cancel, true);
    if (cancelResult.enabled) {
      this.cancelManager = new CancelManager(cancelResult.config || undefined);
    }

    // Retry：默认关闭，显式配置才开启
    const retryResult = RetryManager.normalize(config.retry);
    if (retryResult.enabled) {
      this.retryManager = new RetryManager(retryResult.config);
    }
  }
  
  /**
   * 获取 Token 管理器
   * @param requestToken 请求级配置
   * @returns Token 管理器实例
   */
  getTokenManager(requestToken?: Partial<TokenManagerConfig> | boolean): ITokenManager | undefined {
    // 有实例级管理器：请求默认用它（除非显式禁用）
    if (this.tokenManager) {
      if (requestToken !== undefined) {
        const tokenResult = TokenManager.normalize(requestToken);
        if (!tokenResult.enabled) {
          return undefined; // 请求显式禁用
        }
      }
      return this.tokenManager;
    }

    // 无实例级管理器：只有请求显式要求才创建私有管理器
    if (requestToken !== undefined) {
      const tokenResult = TokenManager.normalize(requestToken);
      if (tokenResult.enabled) {
        return this.getOrCreatePrivateTokenManager(tokenResult.config);
      }
    }

    return undefined;
  }
  
  /**
   * 获取防重复提交管理器
   * @param requestDedupe 请求级配置
   * @returns 防重复提交管理器实例
   */
  getDedupeManager(requestDedupe?: DedupeShortcut): IDedupeManager | undefined {
    // 有实例级管理器：请求默认用它（除非显式禁用）
    if (this.dedupeManager) {
      if (requestDedupe !== undefined) {
        const dedupeResult = DedupeManager.normalize(requestDedupe);
        if (!dedupeResult.enabled) {
          return undefined; // 请求显式禁用
        }
      }
      return this.dedupeManager;
    }

    // 无实例级管理器：只有请求显式要求才创建私有管理器
    if (requestDedupe !== undefined) {
      const dedupeResult = DedupeManager.normalize(requestDedupe);
      if (dedupeResult.enabled) {
        return this.getOrCreatePrivateDedupeManager(dedupeResult.config);
      }
    }

    return undefined;
  }

  /**
   * 获取请求取消管理器
   * @param requestCancel 请求级配置
   * @returns 请求取消管理器实例
   */
  getCancelManager(requestCancel?: CancelShortcut): ICancelManager | undefined {
    // 有实例级管理器：请求默认用它（除非显式禁用）
    if (this.cancelManager) {
      if (requestCancel !== undefined) {
        const cancelResult = CancelManager.normalize(requestCancel);
        if (!cancelResult.enabled) {
          return undefined; // 请求显式禁用
        }
      }
      return this.cancelManager;
    }

    // 无实例级管理器：只有请求显式要求才创建私有管理器
    if (requestCancel !== undefined) {
      const cancelResult = CancelManager.normalize(requestCancel);
      if (cancelResult.enabled) {
        return this.getOrCreatePrivateCancelManager(cancelResult.config);
      }
    }

    return undefined;
  }

  /**
   * 获取失败重试管理器
   * @param requestRetry 请求级配置
   * @returns 失败重试管理器实例
   */
  getRetryManager(requestRetry?: RetryShortcut): IRetryManager | undefined {
    // 有实例级管理器：请求默认用它（除非显式禁用）
    if (this.retryManager) {
      if (requestRetry !== undefined) {
        const retryResult = RetryManager.normalize(requestRetry);
        if (!retryResult.enabled) {
          return undefined; // 请求显式禁用
        }
      }
      return this.retryManager;
    }

    // 无实例级管理器：只有请求显式要求才创建私有管理器
    if (requestRetry !== undefined) {
      const retryResult = RetryManager.normalize(requestRetry);
      if (retryResult.enabled) {
        return this.getOrCreatePrivateRetryManager(retryResult.config);
      }
    }

    return undefined;
  }
  
  /**
   * 获取或创建私有级 Token 管理器
   */
  private getOrCreatePrivateTokenManager(config?: Partial<TokenManagerConfig>): ITokenManager {
    if (!this._privateTokenManager) {
      this._privateTokenManager = new TokenManager(config || undefined);
    }
    return this._privateTokenManager;
  }
  
  /**
   * 获取或创建私有级防重复提交管理器
   */
  private getOrCreatePrivateDedupeManager(config?: Partial<DedupeConfig>): IDedupeManager {
    if (!this._privateDedupeManager) {
      this._privateDedupeManager = new DedupeManager(config);
    }
    return this._privateDedupeManager;
  }
  
  /**
   * 获取或创建私有级请求取消管理器
   */
  private getOrCreatePrivateCancelManager(config?: Partial<CancelConfig>): ICancelManager {
    if (!this._privateCancelManager) {
      this._privateCancelManager = new CancelManager(config);
    }
    return this._privateCancelManager;
  }
  
  /**
   * 获取或创建私有级失败重试管理器
   */
  private getOrCreatePrivateRetryManager(config?: Partial<RetryConfig>): IRetryManager {
    if (!this._privateRetryManager) {
      this._privateRetryManager = new RetryManager(config);
    }
    return this._privateRetryManager;
  }
  
  // ==================== 生命周期 ====================
  
  /**
   * 销毁所有管理器，释放资源
   */
  destroy(): void {
    this.tokenManager?.destroy();
    this.dedupeManager?.destroy();
    this.cancelManager?.destroy();
    this.retryManager?.destroy();
    
    this._privateTokenManager?.destroy();
    this._privateDedupeManager?.destroy();
    this._privateCancelManager?.destroy();
    this._privateRetryManager?.destroy();
  }
}
