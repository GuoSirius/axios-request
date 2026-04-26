import { AxiosRequestConfig } from 'axios';
import { DedupeConfig, DedupeItem } from '../types';
import { generateRequestKey } from '../utils/requestKey';

/**
 * 防重复提交管理器
 */
export class DedupeManager {
  private config: DedupeConfig;
  private pendingRequests: Map<string, DedupeItem> = new Map();

  constructor(config: DedupeConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? false,
      duration: config.duration ?? 1000,
      methods: config.methods ?? ['POST', 'PUT', 'PATCH', 'DELETE'],
      generateKey: config.generateKey || generateRequestKey,
    };
  }

  /**
   * 检查是否应该处理该请求
   * @param config 请求配置
   * @returns 是否应该处理
   */
  shouldDedupe(config: AxiosRequestConfig): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const method = (config.method || 'get').toUpperCase();
    return this.config.methods?.includes(method) || false;
  }

  /**
   * 检查是否重复并提交处理
   * @param config 请求配置
   * @param makeRequest 发起请求的函数
   * @returns Promise
   */
  async dedupe<T = any>(config: AxiosRequestConfig, makeRequest: () => Promise<T>): Promise<T> {
    const key = this.config.generateKey!(config);

    // 检查是否有正在进行中的相同请求
    const existing = this.pendingRequests.get(key);
    if (existing) {
      // 有重复请求，返回同一个promise
      return existing.promise as Promise<T>;
    }

    // 创建新的请求
    const promise = new Promise<T>((resolve, reject) => {
      // 设置定时器，到期后从pending中移除
      const timer = setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.config.duration || 1000);

      // 发起请求
      makeRequest()
        .then((result) => {
          clearTimeout(timer);
          this.pendingRequests.delete(key);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          this.pendingRequests.delete(key);
          reject(error);
        });
    });

    // 存储到pending map中
    this.pendingRequests.set(key, {
      timer: setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.config.duration || 1000),
      promise,
      resolve: () => {},
      reject: () => {},
    });

    return promise;
  }

  /**
   * 清除所有待处理的请求
   */
  clear(): void {
    this.pendingRequests.forEach((item) => {
      clearTimeout(item.timer);
    });
    this.pendingRequests.clear();
  }
}
