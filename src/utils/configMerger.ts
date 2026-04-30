import { ConfigMergeOptions } from '../types';

/**
 * 配置合并策略
 * - `merge`: 深度合并（默认）
 * - `replace`: 完全替换
 * - `shallow`: 浅合并
 */
type ConfigMergeStrategy = 'merge' | 'replace' | 'shallow';

/**
 * 深度合并两个对象
 * @param target - 目标对象（优先级低）
 * @param source - 源对象（优先级高）
 * @param options - 合并选项
 * @returns 合并后的对象
 *
 * @example
 * ```typescript
 * // 深度合并
 * const result = deepMerge(
 *   { a: { b: 1, c: 2 } },
 *   { a: { b: 3, d: 4 } }
 * );
 * // => { a: { b: 3, c: 2, d: 4 } }
 *
 * // 数组会被替换，不会合并
 * const result2 = deepMerge(
 *   { a: [1, 2] },
 *   { a: [3, 4] }
 * );
 * // => { a: [3, 4] }
 * ```
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  options: ConfigMergeOptions = {}
): T {
  const result: any = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = (source as any)[key];
      const targetValue = (target as any)[key];

      // 如果不允许 undefined，跳过 undefined 值
      if (!options.allowUndefined && sourceValue === undefined) {
        continue;
      }

      // 如果源值和目标值都是对象（且不是数组），递归合并
      if (
        sourceValue &&
        targetValue &&
        typeof sourceValue === 'object' &&
        typeof targetValue === 'object' &&
        !Array.isArray(sourceValue) &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue, options);
      } else {
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}

/**
 * 浅合并两个对象
 * @param target - 目标对象（优先级低）
 * @param source - 源对象（优先级高）
 * @param options - 合并选项
 * @returns 合并后的对象
 *
 * @example
 * ```typescript
 * // 浅合并
 * const result = shallowMerge(
 *   { a: { b: 1, c: 2 } },
 *   { a: { b: 3 }, d: 4 }
 * );
 * // => { a: { b: 3 }, d: 4 }
 * ```
 */
export function shallowMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  options: ConfigMergeOptions = {}
): T {
  const result: any = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const value = (source as any)[key];
      if (options.allowUndefined || value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result as T;
}

/**
 * 合并两个配置对象
 * @param target - 目标对象（优先级低）
 * @param source - 源对象（优先级高）
 * @param options - 合并选项
 * @returns 合并后的对象
 *
 * @example
 * ```typescript
 * // 深度合并（默认）
 * const result1 = mergeConfig({ a: { b: 1 } }, { a: { c: 2 } });
 * // => { a: { b: 1, c: 2 } }
 *
 * // 浅合并
 * const result2 = mergeConfig(
 *   { a: { b: 1 } },
 *   { a: { c: 2 } },
 *   { strategy: 'shallow' }
 * );
 * // => { a: { c: 2 } }
 *
 * // 完全替换
 * const result3 = mergeConfig(
 *   { a: { b: 1 } },
 *   { a: { c: 2 } },
 *   { strategy: 'replace' }
 * );
 * // => { a: { c: 2 } }
 * ```
 */
export function mergeConfig<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
  options: ConfigMergeOptions = { strategy: 'merge', allowUndefined: false }
): T {
  const strategy = options.strategy || 'merge';

  if (strategy === 'replace') {
    return { ...target, ...source } as T;
  }

  if (strategy === 'shallow') {
    return shallowMerge(target, source, options);
  }

  // 深度合并（默认）
  return deepMerge(target, source, options);
}

/**
 * 创建配置合并器
 * 返回一个函数，可以重复使用相同的默认配置进行合并
 *
 * @param defaultConfig - 默认配置
 * @returns 合并函数
 *
 * @example
 * ```typescript
 * const merger = createConfigMerger({ enabled: false, count: 0 });
 *
 * const config1 = merger({ enabled: true });
 * // => { enabled: true, count: 0 }
 *
 * const config2 = merger({ count: 5 });
 * // => { enabled: false, count: 5 }
 * ```
 */
export function createConfigMerger<T extends Record<string, any>>(
  defaultConfig: T
) {
  return (override?: Partial<T>, options?: ConfigMergeOptions): T => {
    if (!override) return { ...defaultConfig };
    return mergeConfig(defaultConfig, override, options);
  };
}
