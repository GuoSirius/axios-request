import { AxiosRequestConfig } from 'axios';
import { RetryConfig } from '../types';

/**
 * 请求重试管理器
 */
export class RetryManager {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? false,
      maxRetries: config.maxRetries ?? 3,
      delay: config.delay ?? 100,
      exponentialBackoff: config.exponentialBackoff ?? false,
    };
  }

  /**
   * 检查是否应该处理该请求
   * @param config 请求配置
   * @returns 是否应该重试
   */
  shouldRetry(config: AxiosRequestConfig): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // 检查请求配置中是否有重试次数
    const extendedConfig = config as any;
    const maxRetries = extendedConfig._maxRetries || this.config.maxRetries || 3;
    const currentRetry = extendedConfig._retryCount || 0;

    return currentRetry < maxRetries;
  }

  /**
   * 判断是否应该对特定错误进行重试
   * @param error 错误对象
   * @param retryCount 当前重试次数
   * @returns 是否应该重试
   */
  shouldRetryOnError(error: any, retryCount: number): boolean {
    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error, retryCount);
    }

    // 默认：网络错误或5xx错误才重试
    if (!error.response) {
      // 网络错误
      return true;
    }

    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  /**
   * 计算重试延迟
   * @param retryCount 当前重试次数
   * @returns 延迟毫秒数
   */
  calculateDelay(retryCount: number): number {
    const baseDelay = this.config.delay || 100;

    if (this.config.exponentialBackoff) {
      // 指数退避：delay * 2^retryCount
      return baseDelay * Math.pow(2, retryCount);
    }

    return baseDelay;
  }

  /**
   * 执行重试
   * @param config 请求配置
   * @param makeRequest 发起请求的函数
   * @param retryCount 当前重试次数
   * @returns Promise
   */
  async retry<T = any>(
    config: AxiosRequestConfig,
    makeRequest: (config: AxiosRequestConfig) => Promise<T>,
    retryCount: number
  ): Promise<T> {
    // 计算延迟
    const delay = this.calculateDelay(retryCount);

    // 等待延迟
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 更新重试次数
    const newConfig = { ...config } as any;
    newConfig._retryCount = retryCount + 1;

    // 发起请求
    return makeRequest(newConfig);
  }
}
