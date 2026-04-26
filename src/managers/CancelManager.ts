import { AxiosRequestConfig } from 'axios';
import { CancelConfig, GenerateKeyFunction } from '../types';
import { normalizeGenerateKey } from '../utils/requestKey';

/**
 * 请求取消管理器（用于搜索等场景，自动取消上次请求）
 */
export class CancelManager {
  private config: CancelConfig & { generateKey: GenerateKeyFunction };
  private pendingRequests: Map<string, AbortController> = new Map();

  constructor(config: CancelConfig = {}) {
    const defaultMethods = ['GET'];
    // 标准化配置（methods 统一转为大写）
    this.config = {
      ...config,
      enabled: config.enabled ?? true,
      methods: (config.methods ?? defaultMethods).map((m) => String(m).toUpperCase()),
      generateKey: normalizeGenerateKey(config.generateKey),
    } as CancelConfig & { generateKey: GenerateKeyFunction };
  }

  /**
   * 检查是否应该处理该请求
   */
  shouldCancel(config: AxiosRequestConfig): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const method = (config.method || 'get').toUpperCase();
    return (this.config.methods || []).includes(method);
  }

  /**
   * 处理请求（取消上次的相同请求）
   */
  setupCancel(config: AxiosRequestConfig): AxiosRequestConfig {
    const key = this.config.generateKey(config);

    // 如果已有相同请求，取消它
    if (this.pendingRequests.has(key)) {
      this.pendingRequests.get(key)?.abort();
    }

    // 创建新的 AbortController
    const controller = new AbortController();
    this.pendingRequests.set(key, controller);

    // 修改请求配置，添加 signal
    const newConfig = { ...config, signal: controller.signal };

    // 请求完成后，从 pending 中移除
    controller.signal.addEventListener('abort', () => {
      this.pendingRequests.delete(key);
    });

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
