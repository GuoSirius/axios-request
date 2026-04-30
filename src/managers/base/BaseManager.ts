import { ManagerDefaultConfig, ManagerContext, ConfigMergeOptions } from '../../types';
import { mergeConfig as mergeConfigUtil, deepMerge as deepMergeUtil } from '../../utils/configMerger';

/**
 * 管理器基类
 * 所有管理器都应该继承此基类，以获得统一的接口和生命周期管理
 *
 * @typeParam TConfig - 管理器配置类型
 * @typeParam TContext - 管理器上下文类型
 *
 * @example
 * ```typescript
 * interface MyConfig extends ManagerDefaultConfig {
 *   customOption: string;
 * }
 *
 * interface MyContext extends ManagerContext {
 *   customOption: string;
 * }
 *
 * class MyManager extends BaseManager<MyConfig, MyContext> {
 *   protected getDefaultConfig(): MyConfig {
 *     return {
 *       enabled: false,
 *       customOption: 'default',
 *     };
 *   }
 *
 *   createContext(override?: Partial<MyConfig>): MyContext {
 *     const config = this.mergeConfig(override);
 *     return {
 *       enabled: config.enabled,
 *       customOption: config.customOption,
 *     };
 *   }
 *
 *   destroy(): void {
 *     // 清理资源
 *   }
 * }
 * ```
 */
export abstract class BaseManager<TConfig extends ManagerDefaultConfig, TContext extends ManagerContext> {
  /** 默认配置（合并后的） */
  protected defaultConfig: TConfig;

  /** 管理器名称（用于日志和调试） */
  protected abstract readonly managerName: string;

  /**
   * 构造函数
   * @param config - 用户提供的配置（部分）
   */
  constructor(config: Partial<TConfig>) {
    this.defaultConfig = this.mergeWithDefaults(config);
  }

  /**
   * 获取默认配置
   * 子类必须实现此方法，返回管理器的默认配置
   *
   * @returns 默认配置
   */
  protected abstract getDefaultConfig(): TConfig;

  /**
   * 创建请求上下文
   * 子类必须实现此方法，根据配置创建请求级别的上下文
   *
   * @param override - 请求级别的配置覆盖（可选）
   * @returns 请求上下文
   */
  abstract createContext(override?: Partial<TConfig>): TContext;

  /**
   * 销毁管理器，清理所有资源
   * 子类必须实现此方法，清理定时器、队列等资源
   */
  abstract destroy(): void;

  /**
   * 合并用户配置与默认配置
   * @param config - 用户提供的配置（部分）
   * @returns 合并后的完整配置
   */
  protected mergeWithDefaults(config: Partial<TConfig>): TConfig {
    const defaults = this.getDefaultConfig();
    return this.mergeConfig(config, defaults);
  }

  /**
   * 合并配置
   * 支持深度合并和浅合并
   *
   * @param source - 源配置（优先级高）
   * @param target - 目标配置（优先级低，默认为 defaultConfig）
   * @param options - 合并选项
   * @returns 合并后的配置
   *
   * @example
   * ```typescript
   * // 深度合并（默认）
   * const merged = this.mergeConfig({ a: { b: 2 } }, { a: { c: 3 } });
   * // => { a: { b: 2, c: 3 } }
   *
   * // 浅合并
   * const merged = this.mergeConfig({ a: { b: 2 } }, { a: { c: 3 } }, { strategy: 'shallow' });
   * // => { a: { b: 2 } }
   *
   * // 完全替换
   * const merged = this.mergeConfig({ a: { b: 2 } }, { a: { c: 3 } }, { strategy: 'replace' });
   * // => { a: { b: 2 } }
   * ```
   */
  protected mergeConfig(
    source: Partial<TConfig>,
    target?: TConfig,
    options: ConfigMergeOptions = { strategy: 'merge', allowUndefined: false }
  ): TConfig {
    const base = target || this.defaultConfig;
    return mergeConfigUtil(base, source, options);
  }

  /**
   * 深度合并两个对象（实例方法包装）
   * @param target - 目标对象
   * @param source - 源对象
   * @param options - 合并选项
   * @returns 合并后的对象
   */
  protected deepMerge(target: any, source: any, options: ConfigMergeOptions): any {
    return deepMergeUtil(target, source, options);
  }

  /**
   * 检查管理器是否启用
   * @returns 是否启用
   */
  isEnabled(): boolean {
    return this.defaultConfig.enabled;
  }

  /**
   * 获取默认配置（公开方法）
   * @returns 默认配置
   */
  getDefaultConfigPublic(): TConfig {
    return { ...this.defaultConfig };
  }
}
