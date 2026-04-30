import { describe, it, expect, vi } from 'vitest';
import { deepMerge, shallowMerge, mergeConfig, createConfigMerger } from '../src/utils/configMerger';

// ============================================
// deepMerge - 深度合并
// ============================================
describe('deepMerge - 深度合并', () => {
  it('基本合并', () => {
    const result = deepMerge(
      { a: 1, b: 2 },
      { b: 3, c: 4 }
    );
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('嵌套对象深度合并', () => {
    const result = deepMerge(
      { a: { b: 1, c: 2 } },
      { a: { b: 3, d: 4 } }
    );
    expect(result).toEqual({ a: { b: 3, c: 2, d: 4 } });
  });

  it('多层嵌套', () => {
    const result = deepMerge(
      { a: { b: { c: 1 } } },
      { a: { b: { d: 2 } } }
    );
    expect(result).toEqual({ a: { b: { c: 1, d: 2 } } });
  });

  it('数组会被替换而非合并', () => {
    const result = deepMerge(
      { a: [1, 2, 3] },
      { a: [4, 5] }
    );
    expect(result).toEqual({ a: [4, 5] });
  });

  it('undefined 值默认被跳过', () => {
    const result = deepMerge(
      { a: 1, b: 2 },
      { b: undefined, c: 3 }
    );
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('allowUndefined 为 true 时保留 undefined', () => {
    const result = deepMerge(
      { a: 1 },
      { a: undefined, b: 2 },
      { allowUndefined: true }
    );
    expect(result).toEqual({ a: undefined, b: 2 });
  });

  it('null 值保留', () => {
    const result = deepMerge(
      { a: 1 },
      { a: null }
    );
    expect(result).toEqual({ a: null });
  });

  it('空对象合并', () => {
    const result = deepMerge({}, { a: 1 });
    expect(result).toEqual({ a: 1 });
  });

  it('空源对象', () => {
    const result = deepMerge({ a: 1 }, {});
    expect(result).toEqual({ a: 1 });
  });

  it('两者都为空', () => {
    const result = deepMerge({}, {});
    expect(result).toEqual({});
  });
});

// ============================================
// shallowMerge - 浅合并
// ============================================
describe('shallowMerge - 浅合并', () => {
  it('基本合并', () => {
    const result = shallowMerge(
      { a: 1, b: 2 },
      { b: 3, c: 4 }
    );
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('嵌套对象直接替换', () => {
    const result = shallowMerge(
      { a: { b: 1, c: 2 } },
      { a: { b: 3 } }
    );
    expect(result).toEqual({ a: { b: 3 } });
  });

  it('undefined 值默认被跳过', () => {
    const result = shallowMerge(
      { a: 1, b: 2 },
      { b: undefined, c: 3 }
    );
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('allowUndefined 为 true 时保留 undefined', () => {
    const result = shallowMerge(
      { a: 1 },
      { a: undefined },
      { allowUndefined: true }
    );
    expect(result).toEqual({ a: undefined });
  });

  it('数组直接替换', () => {
    const result = shallowMerge(
      { a: [1, 2] },
      { a: [3, 4, 5] }
    );
    expect(result).toEqual({ a: [3, 4, 5] });
  });
});

// ============================================
// mergeConfig - 配置合并（默认深度合并）
// ============================================
describe('mergeConfig - 配置合并', () => {
  it('默认深度合并', () => {
    const result = mergeConfig(
      { a: { b: 1, c: 2 } },
      { a: { b: 3 } }
    );
    expect(result).toEqual({ a: { b: 3, c: 2 } });
  });

  it('strategy: replace 完全替换', () => {
    const result = mergeConfig(
      { a: { b: 1, c: 2 } },
      { a: { b: 3 } },
      { strategy: 'replace' }
    );
    expect(result).toEqual({ a: { b: 3 } });
  });

  it('strategy: shallow 浅合并', () => {
    const result = mergeConfig(
      { a: { b: 1, c: 2 } },
      { a: { b: 3 } },
      { strategy: 'shallow' }
    );
    expect(result).toEqual({ a: { b: 3 } });
  });

  it('保留未定义的属性（allowUndefined）', () => {
    const result = mergeConfig(
      { a: 1 },
      { b: undefined },
      { allowUndefined: true }
    );
    expect(result).toEqual({ a: 1, b: undefined });
  });
});

// ============================================
// createConfigMerger - 创建配置合并器
// ============================================
describe('createConfigMerger - 创建配置合并器', () => {
  it('创建合并器', () => {
    const merger = createConfigMerger({ enabled: false, count: 0 });
    expect(typeof merger).toBe('function');
  });

  it('使用默认配置', () => {
    const merger = createConfigMerger({ enabled: false, count: 0 });
    const result = merger();
    expect(result).toEqual({ enabled: false, count: 0 });
  });

  it('覆盖部分配置', () => {
    const merger = createConfigMerger({ enabled: false, count: 0 });
    const result = merger({ enabled: true });
    expect(result).toEqual({ enabled: true, count: 0 });
  });

  it('覆盖多个配置', () => {
    const merger = createConfigMerger({ enabled: false, count: 0, name: 'test' });
    const result = merger({ enabled: true, count: 5 });
    expect(result).toEqual({ enabled: true, count: 5, name: 'test' });
  });

  it('嵌套对象深度合并', () => {
    const merger = createConfigMerger({ options: { a: 1, b: 2 } });
    const result = merger({ options: { b: 3, c: 4 } });
    expect(result).toEqual({ options: { a: 1, b: 3, c: 4 } });
  });

  it('使用合并选项', () => {
    const merger = createConfigMerger({ a: 1 });
    const result = merger({ a: undefined }, { allowUndefined: true });
    expect(result).toEqual({ a: undefined });
  });

  it('返回副本，不修改默认配置', () => {
    const defaultConfig = { enabled: false, count: 0 };
    const merger = createConfigMerger(defaultConfig);

    merger({ count: 5 });
    expect(defaultConfig).toEqual({ enabled: false, count: 0 });
  });

  it('返回副本，修改结果不影响默认配置', () => {
    const merger = createConfigMerger({ enabled: false, count: 0 });
    const result = merger();

    result.count = 100;
    const result2 = merger();
    expect(result2.count).toBe(0);
  });
});
