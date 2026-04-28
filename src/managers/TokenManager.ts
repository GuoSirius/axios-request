import { AxiosRequestConfig } from 'axios';
import {
  TokenManagerConfig,
  TokenRefreshFailureReason,
} from '../types';

/**
 * Token上下文 - 每个请求独立的token状态
 */
interface TokenContext {
  /** 请求使用的token获取函数（优先级高于全局） */
  getToken: (() => string | null) | null;
}

/**
 * Token管理器 - 处理token过期自动刷新和请求队列
 * 
 * 设计原则：
 * - 实例级状态：isRefreshing、requestQueue（跨请求共享）
 * - 上下文状态：通过参数传递，不存储在Map中
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private isRefreshing: boolean = false;
  private requestQueue: {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }[] = [];

  constructor(config: TokenManagerConfig) {
    this.config = config;
  }

  /**
   * 创建请求上下文
   */
  createContext(getToken?: () => string | null): TokenContext {
    return { getToken: getToken || null };
  }

  /**
   * 获取当前token（优先使用上下文的token获取函数）
   */
  getToken(context?: TokenContext): string | null {
    const getter = context?.getToken || this.config.getAccessToken;
    return getter?.() || null;
  }

  /**
   * 检查正常响应是否表示token失效
   */
  isTokenExpiredFromResponse(response: any): boolean {
    return this.config.isTokenExpiredFromResponse?.(response) ?? false;
  }

  /**
   * 判断是否是token过期错误
   */
  isTokenExpired(error: any): boolean {
    return this.config.isTokenExpired(error);
  }

  /**
   * 设置 Authorization header
   */
  setAuthorization(config: AxiosRequestConfig, token: string): void {
    if (this.config.setAuthorization) {
      this.config.setAuthorization(config, token);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  /**
   * 处理token过期的请求
   */
  async handleExpiredToken(
    context: TokenContext,
    error: any,
    requestConfig: AxiosRequestConfig,
    retryRequest: (config: AxiosRequestConfig) => Promise<any>
  ): Promise<any> {
    if (this.isRefreshing) {
      return this.enqueueRequest(requestConfig);
    }

    this.isRefreshing = true;

    try {
      const refreshResult = await this.config.refreshToken(error);
      await this.config.setTokens(refreshResult);
      
      // 处理队列中的请求（使用新token）
      this.processQueue(null);
      
      // 重试当前请求
      const newToken = this.getToken(context);
      if (newToken) {
        this.setAuthorization(requestConfig, newToken);
      }
      return retryRequest(requestConfig);
    } catch (refreshError) {
      const failureReason = this.determineFailureReason(refreshError);
      this.config.onRefreshFailed?.(failureReason, refreshError);
      this.processQueue(refreshError);
      throw refreshError;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * 将请求加入队列
   */
  private enqueueRequest(_config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject });
    });
  }

  /**
   * 处理队列中的请求
   */
  private processQueue(error: any, newToken?: string): void {
    this.requestQueue.forEach((item) => {
      if (error) {
        item.reject(error);
      } else {
        // 刷新后使用新token重试
        if (newToken) {
          // 注意：这里需要通过回调更新config的token
          item.resolve(undefined);
        } else {
          item.resolve(undefined);
        }
      }
    });
    this.requestQueue = [];
  }

  /**
   * 判断刷新失败的原因
   */
  private determineFailureReason(error: any): TokenRefreshFailureReason {
    if (!error?.response) return 'network_error';
    const status = error.response.status;
    if (status === 401) return 'invalid_refresh_token';
    if (status === 403) return 'forbidden';
    if (status === 408 || error?.code === 'ECONNABORTED') return 'refresh_timeout';
    return 'unknown';
  }
}
