import { AxiosRequestConfig } from 'axios';
import { DedupeConfig, DedupeItem, GenerateKeyFunction } from '../types';
import { normalizeGenerateKey } from '../utils/requestKey';

/**
 * 防重复提交管理器
 */
export class DedupeManager {
  private config: DedupeConfig & { generateKey: GenerateKeyFunction };
  private pendingRequests: Map<string, DedupeItem> = new Map();

  constructor(config: DedupeConfig = {}) {
    const defaultMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    // 标准化配置
    this.config = {
      ...config,
      enabled: config.enabled ?? true,
      duration: config.duration ?? 1000,
      methods: config.methods ?? defaultMethods,
      generateKey: normalizeGenerateKey(config.generateKey),
    } as DedupeConfig & { generateKey: GenerateKeyFunction };
  }

  /**
   * 检查是否应该处理该请求
   */
  shouldDedupe(config: AxiosRequestConfig): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const method = (config.method || 'get').toUpperCase();
    return (this.config.methods || []).includes(method);
  }

  /**
   * 检查是否重复并处理
   */
  async dedupe<T>(config: AxiosRequestConfig, makeRequest: () => Promise<T>): Promise<T> {
    const key = this.config.generateKey(config);

    // 检查是否有正在进行中的相同请求
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    // 创建新的请求
    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.config.duration);

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

    // 存储到 pending map
    this.pendingRequests.set(key, {
      timer: setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.config.duration),
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
