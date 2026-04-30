import { AxiosRequestConfig } from 'axios';
import {
  RetryConfig,
  RetryShortcut,
  RetryContext,
} from '../types';
import { BaseManager } from './base/BaseManager';
import { mergeConfig } from '../utils/configMerger';

/**
 * 请求重试管理器
 * 在网络错误或 5xx 错误时自动重试请求
 *
 * 功能：
 * 1. 支持配置最大重试次数
 * 2. 支持配置重试延迟时间
 * 3. 支持指数退避策略
 * 4. 支持自定义重试条件
 * 5. 自动管理重试定时器，防止资源泄漏
 *
 * @example
 * ```typescript
 * const retryManager = new RetryManager({
 *   enabled: true,
 *   maxRetries: 3,
 *   retryDelay: 100,
 *   exponentialBackoff: false,
 *   retryCondition: (error, retryCount) => {
 *     // 只在网络错误或 5xx 错误时重试
 *     return !error.response || (error.response.status >= 500 && error.response.status < 600);
 *   },
 * });
 *
 * // 使用简写
 * const retryManager2 = new RetryManager(true); // 启用，使用默认配置
 * const retryManager3 = new RetryManager(3); // 启用，设置最大重试次数为 3
 * const retryManager4 = new RetryManager((error) => error.code === 'ECONNABORTED'); // 启用，自定义重试条件
 * ```
 */
export class RetryManager extends BaseManager<RetryConfig, RetryContext> {
  /** 管理器名称 */
  protected readonly managerName: string = 'RetryManager';

  /** 进行中的重试定时器（用于资源清理） */
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  /**
   * 构造函数
   * @param config - 重试配置（支持简写）
   */
  constructor(config: RetryShortcut = {}) {
    super(normalizeConfig(config));
  }

  /**
   * 获取默认配置
   * @returns 默认配置
   */
  protected getDefaultConfig(): RetryConfig {
    return {
      enabled: false,
      maxRetries: 3,
      retryDelay: 100,
      exponentialBackoff: false,
    };
  }

  /**
   * 创建请求上下文
   * @param override - 请求级别的配置覆盖（可选）
   * @returns 请求上下文
   *
   * @example
   * ```typescript
   * // 使用默认配置
   * const context = retryManager.createContext();
   *
   * // 覆盖部分配置
   * const context = retryManager.createContext({
   *   maxRetries: 5,
   *   retryDelay: 200,
   * });
   * ```
   */
  createContext(override?: Partial<RetryConfig>): RetryContext {
    const config = this.mergeConfig(override || {});
    return {
      enabled: config.enabled,
      maxRetries: config.maxRetries!,
      retryDelay: config.retryDelay!,
      exponentialBackoff: config.exponentialBackoff!,
      retryCondition: config.retryCondition,
    };
  }

  /**
   * 检查是否应该重试
   * @param context - 请求上下文
   * @param config - Axios 请求配置
   * @returns 是否应该重试
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
   * @param context - 请求上下文
   * @param error - Axios 错误对象
   * @param retryCount - 当前重试次数
   * @returns 是否应该重试
   */
  shouldRetryOnError(context: RetryContext, error: any, retryCount: number): boolean {
    if (context.retryCondition) {
      return context.retryCondition(error, retryCount);
    }
    // 默认：网络错误或 5xx 错误
    if (!error.response) return true;
    const status = error.response.status;
    return status >= 500 && status < 600;
  }

  /**
   * 计算重试延迟
   * @param context - 请求上下文
   * @param retryCount - 当前重试次数
   * @returns 延迟时间（毫秒）
   *
   * @example
   * ```typescript
   * // 指数退避关闭：延迟固定为 retryDelay
   * // retryDelay = 100, retryCount = 0 => 100
   * // retryDelay = 100, retryCount = 1 => 100
   *
   * // 指数退避开启：延迟为 retryDelay * 2^retryCount
   * // retryDelay = 100, retryCount = 0 => 100
   * // retryDelay = 100, retryCount = 1 => 200
   * // retryDelay = 100, retryCount = 2 => 400
   * ```
   */
  calculateDelay(context: RetryContext, retryCount: number): number {
    if (context.exponentialBackoff) {
      return context.retryDelay * Math.pow(2, retryCount);
    }
    return context.retryDelay;
  }

  /**
   * 执行重试
   * @param context - 请求上下文
   * @param config - Axios 请求配置
   * @param makeRequest - 发起请求的函数
   * @param retryCount - 当前重试次数
   * @returns Promise，解析为重试结果
   */
  async retry<T>(
    context: RetryContext,
    config: AxiosRequestConfig,
    makeRequest: (config: AxiosRequestConfig) => Promise<T>,
    retryCount: number
  ): Promise<T> {
    // 计算延迟
    const delay = this.calculateDelay(context, retryCount);

    // 等待延迟
    await this.delay(delay);

    // 更新重试次数
    const newConfig = { ...config } as any;
    newConfig._retryCount = retryCount + 1;

    // 发起重试请求
    return makeRequest(newConfig);
  }

  /**
   * 延迟指定时间
   * @param ms - 延迟时间（毫秒）
   * @returns Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        resolve();
      }, ms);
      this.pendingTimers.add(timer);
    });
  }

  /**
   * 销毁管理器，清理所有资源
   * 应该在实例销毁时调用
   */
  destroy(): void {
    // 清理所有进行中的重试定时器
    this.pendingTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.pendingTimers.clear();
  }
}

/**
 * 规范化 RetryConfig
 * @param config - 用户提供的配置（可能是简写）
 * @returns 标准化后的配置
 */
function normalizeConfig(config: RetryShortcut): Partial<RetryConfig> {
  if (!config) return {};
  if (config === true) return { enabled: true };
  if (typeof config === 'number') return { enabled: true, maxRetries: config };
  if (typeof config === 'function') return { enabled: true, retryCondition: config };
  return { ...config };
}
