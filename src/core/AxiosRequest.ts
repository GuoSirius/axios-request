import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  AxiosRequestInstanceConfig,
  AxiosRequestConfigExtended,
  RequestContext,
  TokenManagerConfig,
} from '../types';
import { ManagerRegistry } from './ManagerRegistry';
import { TokenManager } from '../managers/TokenManager';
import { DedupeManager } from '../managers/DedupeManager';
import { CancelManager } from '../managers/CancelManager';
import { RetryManager } from '../managers/RetryManager';

/**
 * AxiosRequest - 基于 axios 的增强请求库
 *
 * 架构设计：
 * - 使用 ManagerRegistry 统一管理所有管理器的生命周期
 * - 实例级管理器具优先，请求级管理器按需创建并缓存
 * - 配置合并：实例配置作为默认值，请求配置作为覆盖，不修改原配置
 *
 * @example
 * ```typescript
 * // 创建实例
 * const api = new AxiosRequest({
 *   baseURL: 'https://api.example.com',
 *   timeout: 10000,
 *   token: tokenConfig, // 实例级 Token 管理（可选）
 *   dedupe: true, // 实例级防重复提交（默认开启）
 *   cancel: true, // 实例级请求取消（默认开启）
 *   retry: { enabled: false }, // 实例级重试（默认关闭）
 * });
 *
 * // 发起请求（使用实例级管理）
 * const data = await api.get('/api/data');
 *
 * // 发起请求（使用请求级管理）
 * const data = await api.get('/api/data', {
 *   retry: { enabled: true, maxRetries: 3 },
 * });
 *
 * // 禁用 Token 管理
 * const data = await api.get('/api/public', { token: false });
 * ```
 */
export class AxiosRequest {
  /** Axios 实例 */
  private instance: AxiosInstance;

  /** 实例配置 */
  private instanceConfig: AxiosRequestInstanceConfig;

  /** 管理注册表 */
  private registry: ManagerRegistry;

  /**
   * 构造函数
   * @param config - 实例配置
   *
   * @example
   * ```typescript
   * const api = new AxiosRequest({
   *   baseURL: 'https://api.example.com',
   *   timeout: 10000,
   *   token: tokenConfig, // 可选，不提供则 Token 管理不启用
   *   dedupe: true, // 默认开启
   *   cancel: true, // 默认开启
   *   retry: false, // 默认关闭
   * });
   * ```
   */
  constructor(config: AxiosRequestInstanceConfig = {}) {
    this.instanceConfig = config;
    this.instance = axios.create(config);

    // 创建管理注册表
    this.registry = new ManagerRegistry(config);

    // 设置拦截器
    this.setupInterceptors();
  }

  /**
   * 设置拦截器
   * - 请求拦截器：处理 Token 注入、请求取消
   * - 响应拦截器：处理 Token 过期、重试
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        const ctx = (config as any)._context as RequestContext | undefined;

        // Token 注入
        if (ctx?.token) {
          const token = this.registry.getTokenManager()?.getToken(ctx.token) || null;
          if (token) {
            this.registry.getTokenManager()?.setAuthorization(config, token);
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * 处理正常响应
   * 检查业务 code 是否表示 Token 过期
   * @param response - Axios 响应对象
   * @returns 响应数据或重试 Promise
   */
  private handleResponse(response: any): any {
    const ctx = (response.config as any)._context as RequestContext | undefined;
    const tokenManager = this.registry.getTokenManager();

    if (ctx?.token && tokenManager?.isTokenExpiredFromResponse(response.data)) {
      // 需要触发 Token 刷新
      const error = { response, config: response.config };
      return this.handleError(error);
    }

    return response;
  }

  /**
   * 处理错误
   * 检查是否需要刷新 Token 或重试
   * @param error - Axios 错误对象
   * @returns 响应数据或拒绝 Promise
   */
  private async handleError(error: any): Promise<any> {
    const ctx = (error.config as any)._context as RequestContext | undefined;
    if (!ctx) return Promise.reject(error);

    // Token 过期处理
    const tokenManager = this.registry.getTokenManager();
    if (ctx.token && tokenManager?.isTokenExpired(error)) {
      try {
        return await tokenManager.handleExpiredToken(
          ctx.token,
          error,
          error.config,
          (config) => this.instance.request(config)
        );
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    // 重试处理
    const retryManager = this.registry.getRetryManager();
    if (ctx.retry && retryManager?.shouldRetry(ctx.retry, error.config)) {
      const retryCount = (error.config as any)._retryCount || 0;
      if (retryManager.shouldRetryOnError(ctx.retry, error, retryCount)) {
        try {
          return await retryManager.retry(
            ctx.retry,
            error.config,
            (config) => this.instance.request(config),
            retryCount
          );
        } catch (retryError) {
          return Promise.reject(retryError);
        }
      }
    }

    return Promise.reject(error);
  }

  /**
   * 创建请求上下文
   * 根据实例级和请求级配置，创建请求级别的管理器上下文
   * @param config - 请求配置
   * @returns 请求上下文
   */
  private createRequestContext(config: AxiosRequestConfigExtended): RequestContext {
    const ctx: RequestContext = {};

    // Token 上下文
    if (config.token !== false) {
      const tokenManager = this.registry.getTokenManager(config.token);
      if (tokenManager) {
        // 获取白名单 URL
        let whitelistUrls: (string | RegExp)[] = [];
        if (typeof config.token === 'object' && config.token !== true) {
          whitelistUrls = config.token.whitelistUrls || [];
        }

        // 创建上下文
        ctx.token = this.registry.createTokenContext(
          tokenManager,
          typeof config.token === 'object' && config.token !== true
            ? config.token.getAccessToken
            : undefined,
          whitelistUrls
        );
      }
    }

    // Dedupe 上下文
    if (config.dedupe !== false) {
      const dedupeManager = this.registry.getDedupeManager(config.dedupe);
      ctx.dedupe = this.registry.createDedupeContext(
        dedupeManager,
        typeof config.dedupe === 'object' ? config.dedupe : undefined
      );
    }

    // Cancel 上下文
    if (config.cancel !== false) {
      const cancelManager = this.registry.getCancelManager(config.cancel);
      ctx.cancel = this.registry.createCancelContext(
        cancelManager,
        typeof config.cancel === 'object' ? config.cancel : undefined
      );
    }

    // Retry 上下文
    if (config.retry !== false) {
      const retryManager = this.registry.getRetryManager(config.retry);
      ctx.retry = this.registry.createRetryContext(
        retryManager,
        typeof config.retry === 'object' ? config.retry : undefined
      );
    }

    return ctx;
  }

  /**
   * 统一处理 contentType
   * @param config - 请求配置
   * @returns 处理后的配置
   */
  private processContentType(config: AxiosRequestConfigExtended): AxiosRequestConfigExtended {
    if (!config.contentType) return config;

    const contentType = config.contentType;
    const finalConfig = { ...config };

    if (contentType === 'json') {
      finalConfig.headers = { ...finalConfig.headers, 'Content-Type': 'application/json;charset=UTF-8' };
    } else if (contentType === 'form') {
      finalConfig.headers = { ...finalConfig.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
    } else if (contentType === 'file') {
      const headers: Record<string, string> = { ...finalConfig.headers } as Record<string, string>;
      delete headers['Content-Type'];
      finalConfig.headers = headers;
    } else {
      finalConfig.headers = { ...finalConfig.headers, 'Content-Type': contentType };
    }

    return finalConfig;
  }

  /**
   * 发起请求
   * @param config - 请求配置
   * @returns 响应数据
   *
   * @example
   * ```typescript
   * // GET 请求
   * const data = await api.request({ url: '/api/data', method: 'GET' });
   *
   * // POST 请求
   * const data = await api.request({
   *   url: '/api/data',
   *   method: 'POST',
   *   data: { name: 'John' },
   *   retry: { enabled: true, maxRetries: 3 },
   * });
   * ```
   */
  async request<T = any>(config: AxiosRequestConfigExtended): Promise<T> {
    let finalConfig = { ...config } as AxiosRequestConfigExtended & { _context?: RequestContext };

    // 统一 method 大写
    if (finalConfig.method && typeof finalConfig.method === 'string') {
      finalConfig.method = finalConfig.method.toUpperCase() as any;
    }

    // 处理 contentType
    finalConfig = this.processContentType(finalConfig);

    // 创建请求上下文并注入到配置
    const ctx = this.createRequestContext(finalConfig);
    finalConfig._context = ctx;

    // 防重复提交
    const dedupeManager = this.registry.getDedupeManager();
    if (ctx.dedupe && dedupeManager.shouldDedupe(ctx.dedupe, finalConfig)) {
      return await dedupeManager.dedupe(
        ctx.dedupe,
        finalConfig,
        () => this.instance.request<T>(finalConfig).then(r => r.data)
      );
    }

    // 请求取消
    const cancelManager = this.registry.getCancelManager();
    if (ctx.cancel && cancelManager.shouldCancel(ctx.cancel, finalConfig)) {
      finalConfig = cancelManager.setupCancel(ctx.cancel, finalConfig) as typeof finalConfig;
    }

    // 发起请求
    const response = await this.instance.request<T>(finalConfig);
    return response.data;
  }

  // ==================== 便捷方法 ====================

  /**
   * GET 请求
   * @param url - 请求 URL
   * @param config - 请求配置（可选）
   * @returns 响应数据
   *
   * @example
   * ```typescript
   * const data = await api.get('/api/data');
   * const data = await api.get('/api/data', { params: { id: 1 } });
   * ```
   */
  get<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  /**
   * POST 请求
   * @param url - 请求 URL
   * @param data - 请求数据（可选）
   * @param config - 请求配置（可选）
   * @returns 响应数据
   *
   * @example
   * ```typescript
   * const data = await api.post('/api/data', { name: 'John' });
   * ```
   */
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  /**
   * PUT 请求
   * @param url - 请求 URL
   * @param data - 请求数据（可选）
   * @param config - 请求配置（可选）
   * @returns 响应数据
   */
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  /**
   * PATCH 请求
   * @param url - 请求 URL
   * @param data - 请求数据（可选）
   * @param config - 请求配置（可选）
   * @returns 响应数据
   */
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  /**
   * DELETE 请求
   * @param url - 请求 URL
   * @param config - 请求配置（可选）
   * @returns 响应数据
   */
  delete<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  /**
   * HEAD 请求
   * @param url - 请求 URL
   * @param config - 请求配置（可选）
   * @returns 响应数据
   */
  head<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'HEAD' });
  }

  /**
   * OPTIONS 请求
   * @param url - 请求 URL
   * @param config - 请求配置（可选）
   * @returns 响应数据
   */
  options<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'OPTIONS' });
  }

  // ==================== 实例方法 ====================

  /**
   * 获取 Axios 实例
   * @returns Axios 实例
   */
  getInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * 设置 Token 管理
   * @param config - Token 管理配置
   */
  setTokenManager(config: AxiosRequestInstanceConfig['token']): void {
    if (config) {
      // 销毁旧的 Token 管理
      this.registry.getTokenManager()?.destroy();

      // 创建新的 Token 管理
      const newRegistry = new ManagerRegistry({
        ...this.instanceConfig,
        token: config,
      });
      this.registry = newRegistry;
      this.instanceConfig.token = config;
    }
  }

  /**
   * 清除所有管理器的待处理请求
   * - 清除防重复提交的待处理请求
   * - 取消请求取消的待处理请求
   */
  clear(): void {
    this.registry.getDedupeManager().clear();
    this.registry.getCancelManager().clear();
  }

  /**
   * 获取实例配置
   * @returns 实例配置
   */
  getInstanceConfig(): AxiosRequestInstanceConfig {
    return { ...this.instanceConfig };
  }

  /**
   * 销毁实例，清理所有资源
   * 应该在实例不再使用时调用
   *
   * @example
   * ```typescript
   * const api = new AxiosRequest(config);
   * // 使用 api...
   * api.destroy(); // 清理资源
   * ```
   */
  destroy(): void {
    this.registry.destroy();
  }
}
