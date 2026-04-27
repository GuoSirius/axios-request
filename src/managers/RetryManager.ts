import { AxiosRequestConfig } from 'axios';
import { RetryConfig, RetryShortcut } from '../types';

/**
 * Retry上下文 - 每个请求独立的重试配置
 */
interface RetryContext {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  retryCondition?: (error: any, retryCount: number) => boolean;
}

/**
 * 规范化 RetryConfig
 */
function normalizeConfig(config: RetryShortcut): Partial<RetryConfig> {
  if (!config) return {};
  if (config === true) return { enabled: true };
  if (typeof config === 'number') return { enabled: true, maxRetries: config };
  if (typeof config === 'function') return { enabled: true, retryCondition: config };
  return { ...config };
}

/**
 * 请求重试管理器
 */
export class RetryManager {
  private defaultConfig: RetryContext;

  constructor(config: RetryShortcut = {}) {
    const normalized = normalizeConfig(config);
    this.defaultConfig = {
      enabled: normalized.enabled ?? false,
      maxRetries: normalized.maxRetries ?? 3,
      retryDelay: normalized.retryDelay ?? 100,
      exponentialBackoff: normalized.exponentialBackoff ?? false,
      retryCondition: normalized.retryCondition,
    };
  }

  /**
   * 创建请求上下文
   */
  createContext(override?: Partial<RetryContext>): RetryContext {
    return {
      enabled: override?.enabled ?? this.defaultConfig.enabled,
      maxRetries: override?.maxRetries ?? this.defaultConfig.maxRetries,
      retryDelay: override?.retryDelay ?? this.defaultConfig.retryDelay,
      exponentialBackoff: override?.exponentialBackoff ?? this.defaultConfig.exponentialBackoff,
      retryCondition: override?.retryCondition ?? this.defaultConfig.retryCondition,
    };
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(context: RetryContext, config: AxiosRequestConfig): boolean {
    if (!context.enabled) return false;
    const extendedConfig = config as any;
    const maxRetries = extendedConfig._maxRetries || context.maxRetries;
    const currentRetry = extendedConfig._retryCount || 0;
    return currentRetry < maxRetries;
  }

  /**
   * 判断是否应该对特定错误进行重试
   */
  shouldRetryOnError(context: RetryContext, error: any, retryCount: number): boolean {
    if (context.retryCondition) {
      return context.retryCondition(error, retryCount);
    }
    // 默认：网络错误或5xx错误
    if (!error.response) return true;
    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  /**
   * 计算重试延迟
   */
  calculateDelay(context: RetryContext, retryCount: number): number {
    if (context.exponentialBackoff) {
      return context.retryDelay * Math.pow(2, retryCount);
    }
    return context.retryDelay;
  }

  /**
   * 执行重试
   */
  async retry<T>(
    context: RetryContext,
    config: AxiosRequestConfig,
    makeRequest: (config: AxiosRequestConfig) => Promise<T>,
    retryCount: number
  ): Promise<T> {
    const delay = this.calculateDelay(context, retryCount);
    await new Promise((resolve) => setTimeout(resolve, delay));

    const newConfig = { ...config } as any;
    newConfig._retryCount = retryCount + 1;

    return makeRequest(newConfig);
  }
}
