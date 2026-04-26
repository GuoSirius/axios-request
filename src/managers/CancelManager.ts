import { AxiosRequestConfig } from 'axios';
import { CancelConfig } from '../types';
import { generateRequestKey } from '../utils/requestKey';

/**
 * 请求取消管理器（用于搜索等场景，自动取消上次请求）
 */
export class CancelManager {
  private config: CancelConfig;
  private pendingRequests: Map<string, AbortController> = new Map();

  constructor(config: CancelConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? true,
      methods: config.methods ?? ['GET'],
      generateKey: config.generateKey || generateRequestKey,
    };
  }

  /**
   * 检查是否应该处理该请求
   * @param config 请求配置
   * @returns 是否应该处理
   */
  shouldCancel(config: AxiosRequestConfig): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const method = (config.method || 'get').toUpperCase();
    return this.config.methods?.includes(method) || false;
  }

  /**
   * 处理请求（取消上次的相同请求）
   * @param config 请求配置
   * @returns 修改后的请求配置
   */
  setupCancel(config: AxiosRequestConfig): AxiosRequestConfig {
    const key = this.config.generateKey!(config);

    // 如果已有相同请求，取消它
    if (this.pendingRequests.has(key)) {
      const oldController = this.pendingRequests.get(key);
      oldController?.abort();
      this.pendingRequests.delete(key);
    }

    // 创建新的AbortController
    const controller = new AbortController();
    this.pendingRequests.set(key, controller);

    // 修改请求配置，添加signal
    const newConfig = { ...config };
    newConfig.signal = controller.signal;

    // 请求完成后，从pending中移除
    const signal = newConfig.signal;
    if (signal) {
      (signal as AbortSignal).addEventListener('abort', () => {
        this.pendingRequests.delete(key);
      });
    }

    return newConfig;
  }

  /**
   * 清除所有待处理的请求
   */
  clear(): void {
    this.pendingRequests.forEach((controller) => {
      controller.abort();
    });
    this.pendingRequests.clear();
  }
}
