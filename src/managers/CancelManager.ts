import { AxiosRequestConfig } from 'axios';
import {
  CancelConfig,
  CancelContext,
  CancelShortcut,
} from '../types';
import { BaseManager } from './base/BaseManager';
import { normalizeGenerateKey } from '../utils/requestKey';
import { mergeConfig } from '../utils/configMerger';

/**
 * 请求取消管理器（用于搜索等场景，自动取消上次相同请求）
 *
 * 功能：
 * 1. 支持配置需要取消的方法
 * 2. 支持自定义生成请求 key
 * 3. 自动管理 AbortController，防止资源泄漏
 *
 * @example
 * ```typescript
 * const cancelManager = new CancelManager({
 *   enabled: true,
 *   methods: ['GET'],
 *   generateKey: 'method:url', // 使用 method 和 url 生成 key
 * });
 *
 * // 使用简写
 * const cancelManager2 = new CancelManager(true); // 启用，使用默认配置
 * const cancelManager3 = new CancelManager(['POST', 'PUT']); // 启用，设置取消方法
 * const cancelManager4 = new CancelManager('method:url:data'); // 启用，设置生成 key 的方式
 * ```
 */
export class CancelManager extends BaseManager<CancelConfig, CancelContext> {
  /** 管理器名称 */
  protected readonly managerName: string = 'CancelManager';

  /** 默认取消方法（静态属性，避免在父类构造函数中访问时未初始化） */
  private static readonly defaultMethods = ['GET'];

  /**
   * 规范化配置（静态方法，供外部调用）
   * @param config - 用户提供的配置（可能是简写）
   * @returns { enabled: boolean, config?: Partial<CancelConfig> }
   */
  static normalize(config: CancelShortcut): { enabled: boolean; config?: Partial<CancelConfig> } {
    if (config === undefined || config === null) {
      return { enabled: true }; // 默认开启
    }
    if (config === false) {
      return { enabled: false };
    }
    if (config === true) {
      return { enabled: true, config: { enabled: true } };
    }
    if (Array.isArray(config)) {
      return { enabled: true, config: { enabled: true, methods: config.map(m => String(m).toUpperCase()) } };
    }
    if (typeof config === 'string') {
      return { enabled: true, config: { enabled: true, generateKey: config } };
    }
    if (typeof config === 'function') {
      return { enabled: true, config: { enabled: true, generateKey: config } };
    }
    return { enabled: true, config: { ...config, methods: config.methods?.map((m: string) => m.toUpperCase()) } };
  }

  /** 待处理的请求 Map */
  private pendingRequests: Map<string, AbortController> = new Map();

  /**
   * 构造函数
   * @param config - 取消请求配置（支持简写）
   */
  constructor(config: CancelShortcut = {}) {
    super(normalizeConfig(config));
  }

  /**
   * 获取默认配置
   * @returns 默认配置
   */
  protected getDefaultConfig(): CancelConfig {
    return {
      enabled: true,
      methods: [...CancelManager.defaultMethods],
      generateKey: 'method:url',
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
   * const context = cancelManager.createContext();
   *
   * // 覆盖部分配置
   * const context = cancelManager.createContext({
   *   methods: ['POST', 'PUT'],
   * });
   * ```
   */
  createContext(override?: Partial<CancelConfig>): CancelContext {
    const config = this.mergeConfig(override || {});
    return {
      enabled: config.enabled!,
      methods: config.methods!,
      generateKey: normalizeGenerateKey(config.generateKey),
    };
  }

  /**
   * 检查是否应该处理该请求
   * @param context - 请求上下文
   * @param config - Axios 请求配置
   * @returns 是否应该取消
   */
  shouldCancel(context: CancelContext, config: AxiosRequestConfig): boolean {
    if (!context.enabled) return false;
    const method = (config.method || 'get').toUpperCase();
    return context.methods.includes(method);
  }

  /**
   * 处理请求（取消上次的相同请求）
   * @param context - 请求上下文
   * @param config - Axios 请求配置
   * @returns 新的请求配置（包含 signal）
   *
   * @example
   * ```typescript
   * // 在请求拦截器中
   * if (cancelManager.shouldCancel(context, config)) {
   *   const newConfig = cancelManager.setupCancel(context, config);
   *   return newConfig;
   * }
   * ```
   */
  setupCancel(context: CancelContext, config: AxiosRequestConfig): AxiosRequestConfig {
    const key = context.generateKey(config);

    // 取消上次的相同请求
    this.pendingRequests.get(key)?.abort();

    // 创建新的 AbortController
    const controller = new AbortController();
    this.pendingRequests.set(key, controller);

    // 监听 abort 事件，自动清理
    controller.signal.addEventListener('abort', () => {
      this.pendingRequests.delete(key);
    });

    // 返回新的配置
    return { ...config, signal: controller.signal };
  }

  /**
   * 清除所有待处理的请求
   * 取消所有进行中的请求
   */
  clear(): void {
    this.pendingRequests.forEach((c) => c.abort());
    this.pendingRequests.clear();
  }

  /**
   * 销毁管理器，清理所有资源
   * 应该在实例销毁时调用
   */
  destroy(): void {
    this.clear();
  }
}

/**
 * 规范化 CancelConfig
 * @param config - 用户提供的配置（可能是简写）
 * @returns 标准化后的配置
 */
function normalizeConfig(config: CancelShortcut): Partial<CancelConfig> {
  if (!config) return {};
  if (config === true) return { enabled: true };
  if (Array.isArray(config)) return { enabled: true, methods: config.map(m => String(m).toUpperCase()) };
  if (typeof config === 'string') return { enabled: true, generateKey: config };
  if (typeof config === 'function') return { enabled: true, generateKey: config };
  return { ...config, methods: config.methods?.map((m: string) => m.toUpperCase()) };
}
