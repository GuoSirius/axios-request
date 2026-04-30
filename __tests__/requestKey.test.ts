import { describe, it, expect, vi } from 'vitest';
import {
  generateRequestKey,
  createGenerateKey,
  normalizeGenerateKey,
} from '../src/utils/requestKey';

// ============================================
// generateRequestKey - 完整测试
// ============================================
describe('generateRequestKey - 请求 Key 生成（完整测试）', () => {

  it('基础用法 - 相同请求生成相同 key', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { page: 1 } };
    const config2 = { method: 'GET', url: '/api/users', params: { page: 1 } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).toBe(key2);
  });

  it('不同参数生成不同 key', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { page: 1 } };
    const config2 = { method: 'GET', url: '/api/users', params: { page: 2 } };

    expect(generateRequestKey(config1)).not.toBe(generateRequestKey(config2));
  });

  it('不同方法生成不同 key', () => {
    const config1 = { method: 'GET', url: '/api/users' };
    const config2 = { method: 'POST', url: '/api/users' };

    expect(generateRequestKey(config1)).not.toBe(generateRequestKey(config2));
  });

  it('不同 url 生成不同 key', () => {
    const config1 = { method: 'GET', url: '/api/users' };
    const config2 = { method: 'GET', url: '/api/posts' };

    expect(generateRequestKey(config1)).not.toBe(generateRequestKey(config2));
  });

  it('包含 data 生成不同 key', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { name: '张三' } };
    const config2 = { method: 'POST', url: '/api/users', data: { name: '李四' } };

    expect(generateRequestKey(config1)).not.toBe(generateRequestKey(config2));
  });

  it('相同 data 生成相同 key', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { name: '张三' } };
    const config2 = { method: 'POST', url: '/api/users', data: { name: '张三' } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('params 顺序不影响 key', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { a: 1, b: 2 } };
    const config2 = { method: 'GET', url: '/api/users', params: { b: 2, a: 1 } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('data 顺序不影响 key', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { a: 1, b: 2 } };
    const config2 = { method: 'POST', url: '/api/users', data: { b: 2, a: 1 } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('无 params 生成 key', () => {
    const config = { method: 'GET', url: '/api/users' };
    const key = generateRequestKey(config);
    expect(key).toBe('GET:/api/users::');
  });

  it('无 data 生成 key', () => {
    const config = { method: 'POST', url: '/api/users' };
    const key = generateRequestKey(config);
    expect(key).toBe('POST:/api/users::');
  });

  it('空 params 和 data', () => {
    const config = { method: 'POST', url: '/api/users', params: undefined, data: undefined };
    const key = generateRequestKey(config);
    expect(key).toBe('POST:/api/users::');
  });

  it('嵌套对象 params', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { filter: { type: 'admin' } } };
    const config2 = { method: 'GET', url: '/api/users', params: { filter: { type: 'admin' } } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('嵌套对象 data', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { profile: { age: 25 } } };
    const config2 = { method: 'POST', url: '/api/users', data: { profile: { age: 25 } } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('数组 params', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { tags: ['a', 'b'] } };
    const config2 = { method: 'GET', url: '/api/users', params: { tags: ['a', 'b'] } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('数组 data', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { ids: [1, 2, 3] } };
    const config2 = { method: 'POST', url: '/api/users', data: { ids: [1, 2, 3] } };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });

  it('Date 对象作为 params', () => {
    const date = new Date('2024-01-01');
    const config = { method: 'GET', url: '/api/users', params: { date } };

    expect(() => generateRequestKey(config)).not.toThrow();
  });

  it('Date 对象作为 data', () => {
    const date = new Date('2024-01-01');
    const config = { method: 'POST', url: '/api/users', data: { createdAt: date } };

    expect(() => generateRequestKey(config)).not.toThrow();
  });

  it('undefined 值', () => {
    const config = { method: 'GET', url: '/api/users' } as any;
    config.params = undefined;

    expect(() => generateRequestKey(config)).not.toThrow();
  });

  it('null 值', () => {
    const config1 = { method: 'GET', url: '/api/users', params: null };
    const config2 = { method: 'GET', url: '/api/users', params: null };

    expect(generateRequestKey(config1)).toBe(generateRequestKey(config2));
  });
});

// ============================================
// createGenerateKey - 完整测试
// ============================================
describe('createGenerateKey - 字符串模板生成 Key（完整测试）', () => {

  it('基本模板 method:url', () => {
    const generateKey = createGenerateKey('method:url');
    const config = { method: 'GET', url: '/api/users' };

    expect(generateKey(config)).toBe('GET:/api/users');
  });

  it('only-url 特殊模板', () => {
    const generateKey = createGenerateKey('only-url');
    const config1 = { method: 'GET', url: '/api/users' };
    const config2 = { method: 'POST', url: '/api/users' };

    expect(generateKey(config1)).toBe('GET:/api/users');
    expect(generateKey(config2)).toBe('POST:/api/users');
  });

  it('多字段模板', () => {
    const generateKey = createGenerateKey('method:url:data.id');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { id: 123, name: 'test' }
    };

    expect(generateKey(config)).toBe('POST:/api/users:123');
  });

  it('data 字段 - 完整 data', () => {
    const generateKey = createGenerateKey('data');
    const config1 = { method: 'POST', url: '/api/users', data: { name: '张三' } };
    const config2 = { method: 'POST', url: '/api/users', data: { name: '李四' } };

    expect(generateKey(config1)).not.toBe(generateKey(config2));
  });

  it('data.路径 - 嵌套字段', () => {
    const generateKey = createGenerateKey('data.user.id');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { user: { id: 123, name: 'test' } }
    };

    expect(generateKey(config)).toBe('123');
  });

  it('params 字段', () => {
    const generateKey = createGenerateKey('params');
    const config = {
      method: 'GET',
      url: '/api/users',
      params: { page: 1, size: 10 }
    };

    expect(generateKey(config)).toContain('page');
    expect(generateKey(config)).toContain('size');
  });

  it('params.路径 - 嵌套字段', () => {
    const generateKey = createGenerateKey('params.filter.id');
    const config = {
      method: 'GET',
      url: '/api/users',
      params: { filter: { id: 456 } }
    };

    expect(generateKey(config)).toBe('456');
  });

  it('不存在的字段返回空字符串', () => {
    const generateKey = createGenerateKey('data.nonexistent');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { name: 'test' }
    };

    expect(generateKey(config)).toBe('');
  });

  it('字段别名 m 和 u', () => {
    const generateKey = createGenerateKey('m:u');
    const config = { method: 'POST', url: '/api/test' };

    expect(generateKey(config)).toBe('POST:/api/test');
  });

  it('方法名自动转大写', () => {
    const generateKey = createGenerateKey('method:url');
    const config = { method: 'post', url: '/api/users' };

    expect(generateKey(config)).toBe('POST:/api/users');
  });

  it('data.id 为 undefined 时返回空字符串', () => {
    const generateKey = createGenerateKey('method:url:data.id');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { name: 'test' }
    };

    expect(generateKey(config)).toBe('POST:/api/users:');
  });

  it('data.id 为 null 时返回 "null" 字符串', () => {
    const generateKey = createGenerateKey('method:url:data.id');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { id: null }
    };

    expect(generateKey(config)).toBe('POST:/api/users:null');
  });

  it('data.id 为 0 时返回 "0"', () => {
    const generateKey = createGenerateKey('method:url:data.id');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { id: 0 }
    };

    expect(generateKey(config)).toBe('POST:/api/users:0');
  });

  it('data.id 为 false 时返回 "false"', () => {
    const generateKey = createGenerateKey('method:url:data.active');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: { active: false }
    };

    expect(generateKey(config)).toBe('POST:/api/users:false');
  });

  it('多层嵌套路径', () => {
    const generateKey = createGenerateKey('data.a.b.c');
    const config = {
      method: 'POST',
      url: '/api/test',
      data: { a: { b: { c: 'deep' } } }
    };

    expect(generateKey(config)).toBe('deep');
  });

  it('多层嵌套路径中间断开', () => {
    const generateKey = createGenerateKey('data.a.b.c');
    const config = {
      method: 'POST',
      url: '/api/test',
      data: { a: { x: 1 } }
    };

    expect(generateKey(config)).toBe('');
  });

  it('params 为空对象', () => {
    const generateKey = createGenerateKey('params');
    const config = {
      method: 'GET',
      url: '/api/users',
      params: {}
    };

    expect(generateKey(config)).toBe('{}');
  });

  it('data 为空对象', () => {
    const generateKey = createGenerateKey('data');
    const config = {
      method: 'POST',
      url: '/api/users',
      data: {}
    };

    expect(generateKey(config)).toBe('{}');
  });

  it('模板包含多余空格', () => {
    const generateKey = createGenerateKey('  method : url  ');
    const config = { method: 'GET', url: '/api/test' };

    expect(generateKey(config)).toBe('GET:/api/test');
  });

  it('单个字段', () => {
    const generateKey = createGenerateKey('method');
    const config = { method: 'POST', url: '/api/test' };

    expect(generateKey(config)).toBe('POST');
  });

  it('包含多个相同的字段', () => {
    const generateKey = createGenerateKey('method:method:url');
    const config = { method: 'GET', url: '/api/test' };

    expect(generateKey(config)).toBe('GET:GET:/api/test');
  });
});

// ============================================
// normalizeGenerateKey - 完整测试
// ============================================
describe('normalizeGenerateKey - 标准化 Key 生成函数（完整测试）', () => {

  it('undefined 返回默认 generateRequestKey', () => {
    const generateKey = normalizeGenerateKey(undefined);

    const config1 = { method: 'GET', url: '/api/users', params: { page: 1 } };
    const config2 = { method: 'GET', url: '/api/users', params: { page: 1 } };

    expect(generateKey(config1)).toBe(generateKey(config2));
  });

  it('函数直接返回', () => {
    const customFn = vi.fn((config) => `custom:${config.url}`);
    const generateKey = normalizeGenerateKey(customFn);

    const config = { method: 'GET', url: '/api/users' };
    expect(generateKey(config)).toBe('custom:/api/users');
    expect(customFn).toHaveBeenCalledWith(config);
  });

  it('字符串转换为函数', () => {
    const generateKey = normalizeGenerateKey('method:url');
    const config = { method: 'GET', url: '/api/users' };

    expect(generateKey(config)).toBe('GET:/api/users');
  });

  it('字符串 - method:url', () => {
    const generateKey = normalizeGenerateKey('method:url');
    expect(generateKey({ method: 'POST', url: '/test' })).toBe('POST:/test');
  });

  it('字符串 - only-url', () => {
    const generateKey = normalizeGenerateKey('only-url');
    expect(generateKey({ method: 'GET', url: '/test' })).toBe('GET:/test');
  });

  it('字符串 - data.id', () => {
    const generateKey = normalizeGenerateKey('data.id');
    expect(generateKey({ method: 'POST', url: '/test', data: { id: 123 } })).toBe('123');
  });

  it('null 返回默认函数', () => {
    const generateKey = normalizeGenerateKey(null);

    const config1 = { method: 'GET', url: '/api/users' };
    const config2 = { method: 'GET', url: '/api/users' };

    expect(generateKey(config1)).toBe(generateKey(config2));
  });
});

// ============================================
// Edge Cases
// ============================================
describe('请求 Key 生成 - 边界情况', () => {

  describe('generateRequestKey 边界情况', () => {
    it('url 为 undefined', () => {
      const config = { method: 'GET', url: undefined } as any;
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('method 为 undefined', () => {
      const config = { method: undefined, url: '/api/test' } as any;
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('混合类型 params', () => {
      const config = { method: 'GET', url: '/api/test', params: { str: 'a', num: 1, bool: true, null: null } };
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('混合类型 data', () => {
      const config = { method: 'POST', url: '/api/test', data: { str: 'a', num: 1, bool: true, null: null } };
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('深嵌套对象', () => {
      const config = {
        method: 'POST',
        url: '/api/test',
        data: { a: { b: { c: { d: { e: { f: 'deep' } } } } } }
      };
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('大数字', () => {
      const config = { method: 'GET', url: '/api/test', params: { big: Number.MAX_SAFE_INTEGER } };
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('特殊字符 url', () => {
      const config = { method: 'GET', url: '/api/test?a=1&b=2&c=3' };
      expect(() => generateRequestKey(config)).not.toThrow();
    });

    it('unicode 字符', () => {
      const config = { method: 'POST', url: '/api/test', data: { name: '张三', emoji: '😀' } };
      expect(() => generateRequestKey(config)).not.toThrow();
    });
  });

  describe('createGenerateKey 边界情况', () => {
    it('空模板字符串', () => {
      const generateKey = createGenerateKey('');
      const config = { method: 'POST', url: '/test' };
      expect(generateKey(config)).toBe('');
    });

    it('只有分隔符的模板产生空字段', () => {
      const generateKey = createGenerateKey(':');
      const config = { method: 'POST', url: '/test' };
      // 空字符串字段解析为 undefined，然后转为 ''
      expect(generateKey(config)).toBe(':');
    });

    it('params 路径指向数组', () => {
      const generateKey = createGenerateKey('params.items');
      const config = { method: 'GET', url: '/test', params: { items: ['a', 'b'] } };
      expect(generateKey(config)).toContain('a');
    });

    it('data 路径指向数组', () => {
      const generateKey = createGenerateKey('data.items');
      const config = { method: 'POST', url: '/test', data: { items: [1, 2] } };
      expect(generateKey(config)).toContain('1');
    });

    it('params 路径指向基本类型', () => {
      const generateKey = createGenerateKey('params.name');
      const config = { method: 'GET', url: '/test', params: 'not an object' as any };
      expect(generateKey(config)).toBe('');
    });
  });
});
