import { AxiosRequestConfig } from 'axios';
import { CancelConfig, CancelShortcut } from '../types';
import { normalizeGenerateKey } from '../utils/requestKey';

const defaultMethods = ['GET'];

/**
 * Cancel上下文 - 每个请求独立的取消配置
 */
interface CancelContext {
  enabled: boolean;
  methods: string[];
  generateKey: (config: AxiosRequestConfig) => string;
}

/**
 * 规范化 CancelConfig
 */
function normalizeConfig(config: CancelShortcut): Partial<CancelConfig> {
  if (!config) return {};
  if (config === true) return { enabled: true };
  if (Array.isArray(config)) return { enabled: true, methods: config.map(m => String(m).toUpperCase()) };
  if (typeof config === 'string') return { enabled: true, generateKey: config };
  if (typeof config === 'function') return { enabled: true, generateKey: config };
  return { ...config, methods: config.methods?.map((m: string) => m.toUpperCase()) };
}

/**
 * 请求取消管理器（用于搜索等场景，自动取消上次请求）
 */
export class CancelManager {
  private defaultConfig: CancelContext;
  private pendingRequests: Map<string, AbortController> = new Map();

  constructor(config: CancelShortcut = {}) {
    const normalized = normalizeConfig(config);
    this.defaultConfig = {
      enabled: normalized.enabled ?? true,
      methods: normalized.methods ?? defaultMethods,
      generateKey: normalizeGenerateKey(normalized.generateKey),
    };
  }

  /**
   * 创建请求上下文
   */
  createContext(override?: Partial<CancelContext>): CancelContext {
    return {
      enabled: override?.enabled ?? this.defaultConfig.enabled,
      methods: override?.methods ?? this.defaultConfig.methods,
      generateKey: override?.generateKey ?? this.defaultConfig.generateKey,
    };
  }

  /**
   * 检查是否应该处理该请求
   */
  shouldCancel(context: CancelContext, config: AxiosRequestConfig): boolean {
    if (!context.enabled) return false;
    const method = (config.method || 'get').toUpperCase();
    return context.methods.includes(method);
  }

  /**
   * 处理请求（取消上次的相同请求）
   */
  setupCancel(context: CancelContext, config: AxiosRequestConfig): AxiosRequestConfig {
    const key = context.generateKey(config);

    this.pendingRequests.get(key)?.abort();

    const controller = new AbortController();
    this.pendingRequests.set(key, controller);

    const newConfig = { ...config, signal: controller.signal };
    controller.signal.addEventListener('abort', () => this.pendingRequests.delete(key));

    return newConfig;
  }

  /**
   * 清除所有待处理的请求
   */
  clear(): void {
    this.pendingRequests.forEach((c) => c.abort());
    this.pendingRequests.clear();
  }
}
