/**
 * 管理器注册表
 * 
 * 统一管理所有功能管理器，支持实例级和私有级两种模式。
 * 
 * 核心规则：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 1. Token：默认关闭，需要显式配置才能开启                       │
 * │ 2. Dedupe/Cancel/Retry：默认开启，可显式配置为 false 关闭     │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * | 场景                        | Token | Dedupe | Cancel | Retry |
 * |-----------------------------|-------|--------|--------|-------|
 * | 实例级有配置                 | 实例级 | 实例级 | 实例级 | 实例级 |
 * | 实例级没有 + 请求级有        | 私有级 | 私有级 | 私有级 | 私有级 |
 * | 都没有                       | 无    | 默认   | 默认   | 默认   |
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
  AxiosRequestConfig,
  TokenConfig,
  DedupeConfig,
  CancelConfig,
  RetryConfig,
  InternalAxiosRequestConfig,
} from '../types';
import type { AxiosError, AxiosResponse, Method } from 'axios';
import { TokenManager } from '../managers/TokenManager';
import { DedupeManager } from '../managers/DedupeManager';
import { CancelManager } from '../managers/CancelManager';
import { RetryManager } from '../managers/RetryManager';

/**
 * 存储已解析的实例级配置（用于检测是否显式配置）
 */
type ResolvedInstanceConfig = {
  token?: boolean | TokenConfig;
  dedupe?: boolean | DedupeConfig;
  cancel?: boolean | CancelConfig;
  retry?: boolean | RetryConfig;
};

export default class ManagerRegistry {
  // ==================== 实例级管理器（构造函数时确定） ====================
  
  private readonly tokenManager?: ITokenManager;
  private readonly dedupeManager?: IDedupeManager;
  private readonly cancelManager?: ICancelManager;
  private readonly retryManager?: IRetryManager;
  
  // ==================== 私有级管理器（按需创建并缓存） ====================
  
  private _privateDedupeManager?: IDedupeManager;
  private _privateCancelManager?: ICancelManager;
  private _privateRetryManager?: IRetryManager;
  
  // ==================== 配置解析 ====================
  
  private readonly resolvedConfig: ResolvedInstanceConfig;
  
  constructor(config: AxiosRequestConfig = {}) {
    // 解析并存储实例级配置（用于检测是否显式配置）
    this.resolvedConfig = this.resolveConfig(config);
    
    // Token：默认关闭，显式配置才创建
    if (this.resolvedConfig.token !== undefined) {
      const tokenConfig = this.resolvedConfig.token;
      if (tokenConfig !== false) {
        this.tokenManager = new TokenManager(
          typeof tokenConfig === 'object' ? tokenConfig : undefined
        );
      }
    }
    
    // Dedupe：默认开启，显式配置为 false 才关闭
    const dedupeConfig = this.resolvedConfig.dedupe;
    if (dedupeConfig === false) {
      // 显式关闭，不创建
    } else {
      this.dedupeManager = new DedupeManager(
        typeof dedupeConfig === 'object' ? dedupeConfig : undefined
      );
    }
    
    // Cancel：默认开启，显式配置为 false 才关闭
    const cancelConfig = this.resolvedConfig.cancel;
    if (cancelConfig === false) {
      // 显式关闭，不创建
    } else {
      this.cancelManager = new CancelManager(
        typeof cancelConfig === 'object' ? cancelConfig : undefined
      );
    }
    
    // Retry：默认开启，显式配置为 false 才关闭
    const retryConfig = this.resolvedConfig.retry;
    if (retryConfig === false) {
      // 显式关闭，不创建
    } else {
      this.retryManager = new RetryManager(
        typeof retryConfig === 'object' ? retryConfig : undefined
      );
    }
  }
  
  /**
   * 解析配置，确定每个管理器是否有显式配置
   */
  private resolveConfig(config: AxiosRequestConfig): ResolvedInstanceConfig {
    return {
      token: config.token,
      dedupe: config.dedupe,
      cancel: config.cancel,
      retry: config.retry,
    };
  }
  
  /**
   * 获取 Token 管理器
   * @param requestToken 请求级配置
   * @returns Token 管理器实例，如果都不配置则返回 undefined
   */
  getTokenManager(requestToken?: TokenConfig | boolean): ITokenManager | undefined {
    // 场景1：实例级有配置
    if (this.tokenManager) {
      return this.tokenManager;
    }
    
    // 场景2：实例级没有 + 请求级有配置
    if (requestToken !== undefined && requestToken !== false) {
      return this.getOrCreatePrivateTokenManager(
        typeof requestToken === 'object' ? requestToken : undefined
      );
    }
    
    // 场景3：都没有，不使用
    return undefined;
  }
  
  /**
   * 获取防重复提交管理器
   * @param requestDedupe 请求级配置
   * @returns 防重复提交管理器实例，默认开启
   */
  getDedupeManager(requestDedupe?: DedupeConfig | boolean): IDedupeManager | undefined {
    // 场景1：实例级有配置
    if (this.dedupeManager) {
      return this.dedupeManager;
    }
    
    // 场景2：实例级没有 + 请求级有配置
    if (requestDedupe !== undefined && requestDedupe !== false) {
      return this.getOrCreatePrivateDedupeManager(
        typeof requestDedupe === 'object' ? requestDedupe : undefined
      );
    }
    
    // 场景3：都没有，默认开启
    return this.getOrCreatePrivateDedupeManager(undefined);
  }
  
  /**
   * 获取请求取消管理器
   * @param requestCancel 请求级配置
   * @returns 请求取消管理器实例，默认开启
   */
  getCancelManager(requestCancel?: CancelConfig | boolean): ICancelManager | undefined {
    // 场景1：实例级有配置
    if (this.cancelManager) {
      return this.cancelManager;
    }
    
    // 场景2：实例级没有 + 请求级有配置
    if (requestCancel !== undefined && requestCancel !== false) {
      return this.getOrCreatePrivateCancelManager(
        typeof requestCancel === 'object' ? requestCancel : undefined
      );
    }
    
    // 场景3：都没有，默认开启
    return this.getOrCreatePrivateCancelManager(undefined);
  }
  
  /**
   * 获取失败重试管理器
   * @param requestRetry 请求级配置
   * @returns 失败重试管理器实例，默认开启
   */
  getRetryManager(requestRetry?: RetryConfig | boolean): IRetryManager | undefined {
    // 场景1：实例级有配置
    if (this.retryManager) {
      return this.retryManager;
    }
    
    // 场景2：实例级没有 + 请求级有配置
    if (requestRetry !== undefined && requestRetry !== false) {
      return this.getOrCreatePrivateRetryManager(
        typeof requestRetry === 'object' ? requestRetry : undefined
      );
    }
    
    // 场景3：都没有，默认开启
    return this.getOrCreatePrivateRetryManager(undefined);
  }
  
  /**
   * 获取或创建私有级 Token 管理器
   * @param config 请求级配置
   */
  private getOrCreatePrivateTokenManager(config?: TokenConfig): ITokenManager {
    if (!this._privateTokenManager) {
      this._privateTokenManager = new TokenManager(config);
    }
    return this._privateTokenManager;
  }
  
  /**
   * 获取或创建私有级防重复提交管理器
   * @param config 请求级配置
   */
  private getOrCreatePrivateDedupeManager(config?: DedupeConfig): IDedupeManager {
    if (!this._privateDedupeManager) {
      this._privateDedupeManager = new DedupeManager(config);
    }
    return this._privateDedupeManager;
  }
  
  /**
   * 获取或创建私有级请求取消管理器
   * @param config 请求级配置
   */
  private getOrCreatePrivateCancelManager(config?: CancelConfig): ICancelManager {
    if (!this._privateCancelManager) {
      this._privateCancelManager = new CancelManager(config);
    }
    return this._privateCancelManager;
  }
  
  /**
   * 获取或创建私有级失败重试管理器
   * @param config 请求级配置
   */
  private getOrCreatePrivateRetryManager(config?: RetryConfig): IRetryManager {
    if (!this._privateRetryManager) {
      this._privateRetryManager = new RetryManager(config);
    }
    return this._privateRetryManager;
  }
  
  // ==================== Token 上下文创建 ====================
  
  createTokenContext(
    manager: ITokenManager,
    requestConfig?: InternalAxiosRequestConfig
  ): { manager: ITokenManager; config: InternalAxiosRequestConfig } {
    return { manager, config: requestConfig! };
  }
  
  // ==================== Dedupe 上下文创建 ====================
  
  createDedupeContext(
    manager: IDedupeManager,
    requestConfig?: DedupeConfig
  ): { manager: IDedupeManager; config: DedupeConfig } {
    return {
      manager,
      config: requestConfig || { enabled: true },
    };
  }
  
  // ==================== Cancel 上下文创建 ====================
  
  createCancelContext(
    manager: ICancelManager,
    requestConfig?: CancelConfig
  ): { manager: ICancelManager; config: CancelConfig } {
    return {
      manager,
      config: requestConfig || { enabled: true },
    };
  }
  
  // ==================== Retry 上下文创建 ====================
  
  createRetryContext(
    manager: IRetryManager,
    requestConfig?: RetryConfig
  ): { manager: IRetryManager; config: RetryConfig } {
    return {
      manager,
      config: requestConfig || { enabled: true },
    };
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
