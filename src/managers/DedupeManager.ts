import { AxiosRequestConfig } from 'axios';
import { DedupeConfig, DedupeItem, DedupeShortcut } from '../types';
import { normalizeGenerateKey } from '../utils/requestKey';

const defaultMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Dedupe上下文 - 每个请求独立的去重配置
 */
interface DedupeContext {
  enabled: boolean;
  timeWindow: number;
  methods: string[];
  generateKey: (config: AxiosRequestConfig) => string;
}

/**
 * 规范化 DedupeConfig
 */
function normalizeConfig(config: DedupeShortcut): Partial<DedupeConfig> {
  if (!config) return {};
  if (config === true) return { enabled: true };
  if (Array.isArray(config)) return { enabled: true, methods: config.map(m => String(m).toUpperCase()) };
  if (typeof config === 'string') return { enabled: true, generateKey: config };
  if (typeof config === 'function') return { enabled: true, generateKey: config };
  return { ...config, methods: config.methods?.map((m: string) => m.toUpperCase()) };
}

/**
 * 防重复提交管理器
 */
export class DedupeManager {
  private defaultConfig: DedupeContext;
  private pendingRequests: Map<string, DedupeItem> = new Map();

  constructor(config: DedupeShortcut = {}) {
    const normalized = normalizeConfig(config);
    this.defaultConfig = {
      enabled: normalized.enabled ?? true,
      timeWindow: normalized.timeWindow ?? 1000,
      methods: normalized.methods ?? defaultMethods,
      generateKey: normalizeGenerateKey(normalized.generateKey),
    };
  }

  /**
   * 创建请求上下文
   */
  createContext(override?: Partial<DedupeContext>): DedupeContext {
    return {
      enabled: override?.enabled ?? this.defaultConfig.enabled,
      timeWindow: override?.timeWindow ?? this.defaultConfig.timeWindow,
      methods: override?.methods ?? this.defaultConfig.methods,
      generateKey: override?.generateKey ?? this.defaultConfig.generateKey,
    };
  }

  /**
   * 检查是否应该处理该请求
   */
  shouldDedupe(context: DedupeContext, config: AxiosRequestConfig): boolean {
    if (!context.enabled) return false;
    const method = (config.method || 'get').toUpperCase();
    return context.methods.includes(method);
  }

  /**
   * 检查是否重复并处理
   */
  async dedupe<T>(
    context: DedupeContext,
    config: AxiosRequestConfig,
    makeRequest: () => Promise<T>
  ): Promise<T> {
    const key = context.generateKey(config);

    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    const timer = setTimeout(() => this.pendingRequests.delete(key), context.timeWindow);
    
    const promise = new Promise<T>((resolve, reject) => {
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

    this.pendingRequests.set(key, { timer, promise, resolve: () => {}, reject: () => {} });

    return promise;
  }

  /**
   * 清除所有待处理的请求
   */
  clear(): void {
    this.pendingRequests.forEach((item) => clearTimeout(item.timer));
    this.pendingRequests.clear();
  }
}
