import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseManager } from '../src/managers/base/BaseManager';
import type { ManagerDefaultConfig } from '../src/types';

// ============================================
// 模拟管理器 - 用于测试 BaseManager
// ============================================
interface TestManagerConfig extends ManagerDefaultConfig {
  optionA?: string;
  optionB?: number;
  nested?: {
    value: string;
  };
}

interface TestManagerContext {
  enabled: boolean;
  optionA: string;
  optionB: number;
  nested: {
    value: string;
  };
}

class TestManager extends BaseManager<TestManagerConfig, TestManagerContext> {
  protected readonly managerName: string = 'TestManager';

  protected getDefaultConfig(): TestManagerConfig {
    return {
      enabled: true,
      optionA: 'defaultA',
      optionB: 100,
      nested: {
        value: 'default',
      },
    };
  }

  createContext(override?: Partial<TestManagerConfig>): TestManagerContext {
    const config = this.mergeConfig(override || {});
    return {
      enabled: config.enabled ?? false,
      optionA: config.optionA || 'defaultA',
      optionB: config.optionB || 100,
      nested: config.nested || { value: 'default' },
    };
  }

  destroy(): void {
    // 测试用，无需清理
  }
}

// ============================================
// BaseManager 测试
// ============================================
describe('BaseManager - 基础功能', () => {

  describe('构造函数和默认配置', () => {
    it('无参数创建实例', () => {
      const manager = new TestManager();
      expect(manager).toBeDefined();
    });

    it('带参数创建实例', () => {
      const manager = new TestManager({
        optionA: 'custom',
        optionB: 200,
      });
      expect(manager).toBeDefined();
    });

    it('获取默认配置', () => {
      const manager = new TestManager();
      const defaultConfig = manager.getDefaultConfigPublic();
      expect(defaultConfig.optionA).toBe('defaultA');
      expect(defaultConfig.optionB).toBe(100);
      expect(defaultConfig.enabled).toBe(true);
    });

    it('返回配置副本，不修改原配置', () => {
      const manager = new TestManager();
      const defaultConfig = manager.getDefaultConfigPublic();
      defaultConfig.optionA = 'modified';
      defaultConfig.optionB = 999;
      const defaultConfig2 = manager.getDefaultConfigPublic();
      expect(defaultConfig2.optionA).toBe('defaultA');
      expect(defaultConfig2.optionB).toBe(100);
    });
  });

  describe('isEnabled - 启用状态检查', () => {
    it('enabled 为 true 时返回 true', () => {
      const manager = new TestManager({ enabled: true });
      expect(manager.isEnabled()).toBe(true);
    });

    it('enabled 为 false 时返回 false', () => {
      const manager = new TestManager({ enabled: false });
      expect(manager.isEnabled()).toBe(false);
    });

    it('enabled 为 undefined 时使用默认值 true', () => {
      const manager = new TestManager({});
      expect(manager.isEnabled()).toBe(true);
    });
  });

  describe('createContext - 上下文创建', () => {
    it('使用默认配置创建上下文', () => {
      const manager = new TestManager();
      const context = manager.createContext();
      expect(context.enabled).toBe(true);
      expect(context.optionA).toBe('defaultA');
      expect(context.optionB).toBe(100);
    });

    it('使用覆盖配置创建上下文', () => {
      const manager = new TestManager();
      const context = manager.createContext({
        optionA: 'customA',
        optionB: 300,
      });
      expect(context.optionA).toBe('customA');
      expect(context.optionB).toBe(300);
    });

    it('嵌套配置合并', () => {
      const manager = new TestManager();
      const context = manager.createContext({
        nested: {
          value: 'customNested',
        },
      });
      expect(context.nested.value).toBe('customNested');
    });

    it('undefined 不覆盖已设置的实例配置', () => {
      const manager = new TestManager({
        optionA: 'custom',
        optionB: 200,
      });
      const context = manager.createContext({
        optionA: undefined,
      });
      // undefined 不覆盖已配置的实例值
      expect(context.optionA).toBe('custom');
    });
  });

  describe('mergeConfig - 配置合并', () => {
    let manager: TestManager;

    beforeEach(() => {
      manager = new TestManager();
    });

    it('深度合并嵌套对象', () => {
      const result = manager.mergeConfig(
        { nested: { value: 'new' } },
        { nested: { value: 'old', extra: 'keep' } }
      );
      expect((result as any).nested.value).toBe('new');
      expect((result as any).nested.extra).toBe('keep');
    });

    it('浅合并模式', () => {
      const result = manager.mergeConfig(
        { nested: { value: 'new' } },
        { nested: { value: 'old', extra: 'keep' } },
        { strategy: 'shallow' }
      );
      expect((result as any).nested.value).toBe('new');
      expect((result as any).nested.extra).toBeUndefined();
    });

    it('替换模式 - 保留目标中不在源中的属性', () => {
      const result = manager.mergeConfig(
        { optionA: 'replaced' },
        { optionA: 'original', optionB: 200 },
        { strategy: 'replace' }
      );
      expect((result as any).optionA).toBe('replaced');
      // replace 策略是 ...target...source，所以 optionB 保留
      expect((result as any).optionB).toBe(200);
    });

    it('允许 undefined', () => {
      const result = manager.mergeConfig(
        { optionA: undefined },
        { optionA: 'original' },
        { allowUndefined: true }
      );
      expect((result as any).optionA).toBeUndefined();
    });

    it('不允许 undefined（默认）', () => {
      const result = manager.mergeConfig(
        { optionA: undefined },
        { optionA: 'original' }
      );
      expect((result as any).optionA).toBe('original');
    });
  });

  describe('deepMerge - 深度合并', () => {
    let manager: TestManager;

    beforeEach(() => {
      manager = new TestManager();
    });

    it('基本深度合并', () => {
      const result = manager.deepMerge(
        { a: { b: 1 } },
        { a: { c: 2 } },
        { strategy: 'merge' }
      );
      expect(result).toEqual({ a: { b: 1, c: 2 } });
    });

    it('数组直接替换', () => {
      const result = manager.deepMerge(
        { arr: [1, 2] },
        { arr: [3, 4] },
        { strategy: 'merge' }
      );
      expect(result).toEqual({ arr: [3, 4] });
    });

    it('null 值保留', () => {
      const result = manager.deepMerge(
        { val: 'exists' },
        { val: null },
        { strategy: 'merge' }
      );
      expect(result).toEqual({ val: null });
    });
  });

  describe('destroy - 销毁', () => {
    it('destroy 方法存在且可调用', () => {
      const manager = new TestManager();
      expect(typeof manager.destroy).toBe('function');
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============================================
// ManagerDefaultConfig 类型测试
// ============================================
describe('ManagerDefaultConfig - 类型测试', () => {
  it('enabled 属性可选', () => {
    const config: ManagerDefaultConfig = {};
    expect(config.enabled).toBeUndefined();
  });

  it('enabled 属性可以为 true', () => {
    const config: ManagerDefaultConfig = { enabled: true };
    expect(config.enabled).toBe(true);
  });

  it('enabled 属性可以为 false', () => {
    const config: ManagerDefaultConfig = { enabled: false };
    expect(config.enabled).toBe(false);
  });
});
