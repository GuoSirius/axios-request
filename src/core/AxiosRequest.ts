import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AxiosRequestInstanceConfig, AxiosRequestConfigExtended } from '../types';
import { TokenManager } from '../managers/TokenManager';
import { DedupeManager } from '../managers/DedupeManager';
import { CancelManager } from '../managers/CancelManager';
import { RetryManager } from '../managers/RetryManager';

/**
 * 将简写配置转换为完整配置对象
 */
function normalizeDedupeConfig(config: AxiosRequestInstanceConfig['dedupe']) {
  if (config === undefined) return undefined;
  if (config === false) return { enabled: false };
  if (config === true) return { enabled: true };
  return config;
}

function normalizeCancelConfig(config: AxiosRequestInstanceConfig['cancel']) {
  if (config === undefined) return undefined;
  if (config === false) return { enabled: false };
  if (config === true) return { enabled: true };
  return config;
}

function normalizeRetryConfig(config: AxiosRequestInstanceConfig['retry']) {
  if (config === undefined) return undefined;
  if (config === false) return { enabled: false };
  if (config === true) return { enabled: true };
  if (typeof config === 'number') return { enabled: true, maxRetries: config };
  return config;
}

/**
 * AxiosRequest - 基于axios的增强请求库
 */
export class AxiosRequest {
  private instance: AxiosInstance;
  private tokenManager?: TokenManager;
  private dedupeManager?: DedupeManager;
  private cancelManager?: CancelManager;
  private retryManager?: RetryManager;

  constructor(config: AxiosRequestInstanceConfig = {}) {
    // 创建axios实例
    this.instance = axios.create(config.axiosConfig);

    // 初始化各管理器
    if (config.tokenManager) {
      this.tokenManager = new TokenManager(config.tokenManager);
    }

    const dedupeConfig = normalizeDedupeConfig(config.dedupe);
    if (dedupeConfig) {
      this.dedupeManager = new DedupeManager(dedupeConfig);
    }

    const cancelConfig = normalizeCancelConfig(config.cancel);
    if (cancelConfig) {
      this.cancelManager = new CancelManager(cancelConfig);
    }

    const retryConfig = normalizeRetryConfig(config.retry);
    if (retryConfig) {
      this.retryManager = new RetryManager(retryConfig);
    }

    // 设置拦截器
    this.setupInterceptors();
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        return this.handleError(error);
      }
    );
  }

  /**
   * 处理请求错误
   * @param error axios错误对象
   * @returns Promise
   */
  private async handleError(error: any): Promise<any> {
    const config = error.config as AxiosRequestConfigExtended;

    // 检查是否是token过期
    if (this.tokenManager && this.tokenManager.isTokenExpired(error)) {
      try {
        return await this.tokenManager.handleExpiredToken(error, config, this.instance);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    // 检查是否需要重试
    if (this.retryManager && this.retryManager.shouldRetry(config)) {
      const retryCount = (config as any)._retryCount || 0;

      if (this.retryManager.shouldRetryOnError(error, retryCount)) {
        try {
          return await this.retryManager.retry(config, (c) => this.instance(c), retryCount);
        } catch (retryError) {
          return Promise.reject(retryError);
        }
      }
    }

    return Promise.reject(error);
  }

  /**
   * 发起请求
   * @param config 请求配置
   * @returns Promise
   */
  async request<T = any>(config: AxiosRequestConfigExtended): Promise<T> {
    let finalConfig = { ...config };

    // 统一将method转为大写，避免用户随意写（如 poSt、Get等）
    if (finalConfig.method && typeof finalConfig.method === 'string') {
      finalConfig.method = finalConfig.method.toUpperCase() as any;
    }

    // 应用防重复提交
    if (this.dedupeManager && this.dedupeManager.shouldDedupe(finalConfig)) {
      return this.dedupeManager.dedupe(finalConfig, () => this.makeRequest(finalConfig));
    }

    // 应用请求取消
    if (this.cancelManager && this.cancelManager.shouldCancel(finalConfig)) {
      finalConfig = this.cancelManager.setupCancel(finalConfig);
    }

    // 发起请求
    return this.makeRequest(finalConfig);
  }

  /**
   * 实际发起请求
   * @param config 请求配置
   * @returns Promise
   */
  private async makeRequest<T = any>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.request<T>(config);
    return response.data;
  }

  /**
   * GET请求
   */
  get<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'GET',
    });
  }

  /**
   * POST请求
   */
  post<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'POST',
      data,
    });
  }

  /**
   * PUT请求
   */
  put<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'PUT',
      data,
    });
  }

  /**
   * PATCH请求
   */
  patch<T = any>(url: string, data?: any, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'PATCH',
      data,
    });
  }

  /**
   * DELETE请求
   */
  delete<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'DELETE',
    });
  }

  /**
   * HEAD请求
   */
  head<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'HEAD',
    });
  }

  /**
   * OPTIONS请求
   */
  options<T = any>(url: string, config?: AxiosRequestConfigExtended): Promise<T> {
    return this.request<T>({
      ...config,
      url,
      method: 'OPTIONS',
    });
  }

  /**
   * 获取axios实例（用于高级配置）
   */
  getInstance(): AxiosInstance {
    return this.instance;
  }

  /**
   * 更新token管理器配置
   */
  setTokenManager(config: AxiosRequestInstanceConfig['tokenManager']): void {
    if (config) {
      this.tokenManager = new TokenManager(config);
    }
  }

  /**
   * 清除所有待处理的请求
   */
  clear(): void {
    this.dedupeManager?.clear();
    this.cancelManager?.clear();
  }
}
