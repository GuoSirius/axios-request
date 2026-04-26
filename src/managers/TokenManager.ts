import { AxiosRequestConfig } from 'axios';
import {
  TokenManagerConfig,
  QueueItem,
  TokenRefreshFailureReason,
} from '../types';

/**
 * Token管理器 - 处理token过期自动刷新和请求队列
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private isRefreshing: boolean = false;
  private requestQueue: QueueItem[] = [];
  private refreshPromise: Promise<any> | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
  }

  /**
   * 判断是否是token过期错误
   * @param error axios错误对象
   * @returns 是否token过期
   */
  isTokenExpired(error: any): boolean {
    return this.config.isTokenExpired(error);
  }

  /**
   * 处理token过期的请求
   * @param error 原始错误
   * @param requestConfig 原始请求配置
   * @param axiosInstance axios实例
   * @returns Promise
   */
  async handleExpiredToken(
    error: any,
    requestConfig: AxiosRequestConfig,
    axiosInstance: any
  ): Promise<any> {
    // 如果已经在刷新中，将请求加入队列
    if (this.isRefreshing) {
      return this.enqueueRequest(requestConfig, axiosInstance);
    }

    // 标记开始刷新
    this.isRefreshing = true;

    try {
      // 调用使用者的刷新token函数
      const refreshResult = await this.config.refreshToken(error);

      // 保存新的token
      await this.config.setTokens(refreshResult);

      // 处理队列中的请求
      this.processQueue(null, refreshResult.accessToken);

      // 用新的token重试当前请求
      return this.retryRequest(requestConfig, axiosInstance);
    } catch (refreshError) {
      // 刷新失败
      const failureReason = this.determineFailureReason(refreshError);
      
      // 调用失败回调
      if (this.config.onRefreshFailed) {
        try {
          await this.config.onRefreshFailed(failureReason, refreshError);
        } catch (callbackError) {
          console.error('onRefreshFailed callback error:', callbackError);
        }
      }

      // 处理队列中的请求（全部失败）
      this.processQueue(refreshError, null);

      // 抛出刷新失败的错误
      throw refreshError;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * 将请求加入队列
   * @param config 请求配置
   * @param axiosInstance axios实例
   * @returns Promise
   */
  private enqueueRequest(config: AxiosRequestConfig, axiosInstance: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        config,
        resolve: (_value) => {
          // 重试请求
          this.retryRequest(config, axiosInstance).then(resolve).catch(reject);
        },
        reject,
      });
    });
  }

  /**
   * 处理队列中的请求
   * @param error 错误（如果有）
   * @param newToken 新的token（如果成功）
   */
  private processQueue(error: any, newToken: string | null): void {
    this.requestQueue.forEach((item) => {
      if (error) {
        item.reject(error);
      } else {
        // 更新token
        if (newToken && item.config.headers) {
          item.config.headers.Authorization = `Bearer ${newToken}`;
        }
        item.resolve(undefined);
      }
    });

    // 清空队列
    this.requestQueue = [];
  }

  /**
   * 重试请求
   * @param config 请求配置
   * @param axiosInstance axios实例
   * @returns Promise
   */
  private retryRequest(config: AxiosRequestConfig, axiosInstance: any): Promise<any> {
    // 获取最新的token
    const token = this.config.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 重试请求
    return axiosInstance(config);
  }

  /**
   * 判断刷新失败的原因
   * @param error 错误对象
   * @returns 失败原因
   */
  private determineFailureReason(error: any): TokenRefreshFailureReason {
    if (!error.response) {
      return 'network_error';
    }

    const status = error.response.status;
    if (status === 401) {
      return 'invalid_refresh_token';
    }
    if (status === 403) {
      return 'forbidden';
    }
    if (status === 408 || error.code === 'ECONNABORTED') {
      return 'refresh_timeout';
    }

    return 'unknown';
  }
}
