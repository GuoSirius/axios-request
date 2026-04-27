import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  AxiosRequestInstanceConfig,
  AxiosRequestConfigExtended,
} from '../types';
import { TokenManager } from '../managers/TokenManager';
import { DedupeManager } from '../managers/DedupeManager';
import { CancelManager } from '../managers/CancelManager';
import { RetryManager } from '../managers/RetryManager';
import { normalizeGenerateKey } from '../utils/requestKey';

/**
 * 请求级别上下文 - 每个请求独立的执行状态
 * 通过闭包实现天然隔离，无需 Map 存储
 */
interface RequestContext {
  token?: ReturnType<TokenManager['createContext']>;
  dedupe?: ReturnType<DedupeManager['createContext']>;
  cancel?: ReturnType<CancelManager['createContext']>;
  retry?: ReturnType<RetryManager['createContext']>;
}

/**
 * AxiosRequest - 基于axios的增强请求库
 * 
 * 架构设计：
 * - 实例级管理器：TokenManager、DedupeManager、CancelManager、RetryManager（单例）
 * - 请求级上下文：通过 createContext() 工厂方法创建，每个请求独立
 * - 配置合并：实例配置作为默认值，请求配置作为覆盖
 */
export class AxiosRequest {
  private instance: AxiosInstance;
  private instanceConfig: AxiosRequestInstanceConfig;
  
  // 实例级管理器
  private tokenManager?: TokenManager;
  private dedupeManager: DedupeManager;
  private cancelManager: CancelManager;
  private retryManager: RetryManager;

  constructor(config: AxiosRequestInstanceConfig = {}) {
    this.instanceConfig = config;
    this.instance = axios.create(config);

    // 初始化管理器
    if (config.token) {
      this.tokenManager = new TokenManager(config.token);
    }
    this.dedupeManager = new DedupeManager(config.dedupe ?? { enabled: true });
    this.cancelManager = new CancelManager(config.cancel ?? { enabled: true });
    this.retryManager = new RetryManager(config.retry ?? {});

    this.setupInterceptors();
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config) => {
        const ctx = (config as any)._context as RequestContext | undefined;
        if (ctx?.token) {
          const token = this.tokenManager?.getToken(ctx.token) || null;
          if (token) {
            this.tokenManager?.setAuthorization(config, token);
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.instance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * 处理正常响应
   */
  private handleResponse(response: any): any {
    const ctx = (response.config as any)._context as RequestContext | undefined;
    if (ctx?.token && this.tokenManager?.isTokenExpiredFromResponse(response.data)) {
      // 需要触发 token 刷新
      const error = { response, config: response.config };
      return this.handleError(error);
    }
    return response;
  }

  /**
   * 处理错误
   */
  private async handleError(error: any): Promise<any> {
    const ctx = (error.config as any)._context as RequestContext | undefined;
    if (!ctx) return Promise.reject(error);

    // Token 过期处理
    if (ctx.token && this.tokenManager?.isTokenExpired(error)) {
      try {
        return await this.tokenManager.handleExpiredToken(
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
    if (ctx.retry && this.retryManager.shouldRetry(ctx.retry, error.config)) {
      const retryCount = (error.config as any)._retryCount || 0;
      if (this.retryManager.shouldRetryOnError(ctx.retry, error, retryCount)) {
        try {
          return await this.retryManager.retry(
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
   */
  private createRequestContext(config: AxiosRequestConfigExtended): RequestContext {
    const ctx: RequestContext = {};

    // Token 上下文
    if (config.token !== false) {
      if (this.tokenManager) {
        ctx.token = this.tokenManager.createContext(
          typeof config.token === 'object' ? config.token.getAccessToken : undefined
        );
      } else if (typeof config.token === 'object') {
        ctx.token = new TokenManager(config.token).createContext(config.token.getAccessToken);
      }
    }

    // Dedupe 上下文
    if (config.dedupe !== false) {
      ctx.dedupe = this.dedupeManager.createContext(
        this.normalizeDedupeOverride(config.dedupe)
      );
    }

    // Cancel 上下文
    if (config.cancel !== false) {
      ctx.cancel = this.cancelManager.createContext(
        this.normalizeCancelOverride(config.cancel)
      );
    }

    // Retry 上下文
    if (config.retry !== false) {
      ctx.retry = this.retryManager.createContext(
        this.normalizeRetryOverride(config.retry)
      );
    }

    return ctx;
  }

  private normalizeDedupeOverride(config: any) {
    if (!config || config === true) return undefined;
    if (typeof config === 'string') return { generateKey: normalizeGenerateKey(config) };
    if (typeof config === 'function') return { generateKey: config };
    if (Array.isArray(config)) return { methods: config };
    return { 
      enabled: config.enabled,
      timeWindow: config.timeWindow,
      methods: config.methods,
      generateKey: config.generateKey ? normalizeGenerateKey(config.generateKey) : undefined,
    };
  }

  private normalizeCancelOverride(config: any) {
    if (!config || config === true) return undefined;
    if (typeof config === 'string') return { generateKey: normalizeGenerateKey(config) };
    if (typeof config === 'function') return { generateKey: config };
    if (Array.isArray(config)) return { methods: config };
    return {
      enabled: config.enabled,
      methods: config.methods,
      generateKey: config.generateKey ? normalizeGenerateKey(config.generateKey) : undefined,
    };
  }

  private normalizeRetryOverride(config: any) {
    if (!config || config === true) return undefined;
    if (typeof config === 'number') return { maxRetries: config };
    if (typeof config === 'function') return { retryCondition: config };
    return config;
  }

  /**
   * 统一处理 contentType
   */
  private processContentType(config: AxiosRequestConfigExtended): AxiosRequestConfigExtended {
    if (!config.contentType) return config;
    
    const contentType = config.contentType;
    let finalConfig = { ...config };

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

    try {
      // 防重复提交
      if (ctx.dedupe && this.dedupeManager.shouldDedupe(ctx.dedupe, finalConfig)) {
        return await this.dedupeManager.dedupe(
          ctx.dedupe,
          finalConfig,
          () => this.instance.request<T>(finalConfig).then(r => r.data)
        );
      }

      // 请求取消
      if (ctx.cancel && this.cancelManager.shouldCancel(ctx.cancel, finalConfig)) {
        finalConfig = this.cancelManager.setupCancel(ctx.cancel, finalConfig) as typeof finalConfig;
      }

      // 发起请求
      const response = await this.instance.request<T>(finalConfig);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // ========== 便捷方法 ==========

  get<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  delete<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  head<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'HEAD' });
  }

  options<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({ ...config, url, method: 'OPTIONS' });
  }

  // ========== 实例方法 ==========

  getInstance(): AxiosInstance {
    return this.instance;
  }

  setTokenManager(config: AxiosRequestInstanceConfig['token']): void {
    if (config) {
      this.tokenManager = new TokenManager(config);
      this.instanceConfig.token = config;
    }
  }

  clear(): void {
    this.dedupeManager.clear();
    this.cancelManager.clear();
  }

  getInstanceConfig(): AxiosRequestInstanceConfig {
    return { ...this.instanceConfig };
  }
}
