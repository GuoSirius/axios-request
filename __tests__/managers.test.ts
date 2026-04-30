import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AxiosRequest, generateRequestKey, createGenerateKey, normalizeGenerateKey } from '../src';
import { TokenManager } from '../src/managers/TokenManager';
import { DedupeManager } from '../src/managers/DedupeManager';
import { CancelManager } from '../src/managers/CancelManager';
import { RetryManager } from '../src/managers/RetryManager';

// Mock axios
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        request: vi.fn().mockResolvedValue({ data: {} }),
      })),
    },
  };
});

// ============================================
// generateRequestKey - 请求 Key 生成
// ============================================
describe('generateRequestKey - 请求 Key 生成', () => {

  it('相同请求生成相同 key', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { page: 1 } };
    const config2 = { method: 'GET', url: '/api/users', params: { page: 1 } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).toBe(key2);
  });

  it('不同参数生成不同 key', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { page: 1 } };
    const config2 = { method: 'GET', url: '/api/users', params: { page: 2 } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).not.toBe(key2);
  });

  it('不同方法生成不同 key', () => {
    const config1 = { method: 'GET', url: '/api/users' };
    const config2 = { method: 'POST', url: '/api/users' };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).not.toBe(key2);
  });

  it('不同 url 生成不同 key', () => {
    const config1 = { method: 'GET', url: '/api/users' };
    const config2 = { method: 'GET', url: '/api/posts' };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).not.toBe(key2);
  });

  it('包含 data 生成不同 key', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { name: '张三' } };
    const config2 = { method: 'POST', url: '/api/users', data: { name: '李四' } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).not.toBe(key2);
  });

  it('相同 data 生成相同 key', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { name: '张三' } };
    const config2 = { method: 'POST', url: '/api/users', data: { name: '张三' } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).toBe(key2);
  });

  it('params 顺序不影响 key', () => {
    const config1 = { method: 'GET', url: '/api/users', params: { a: 1, b: 2 } };
    const config2 = { method: 'GET', url: '/api/users', params: { b: 2, a: 1 } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).toBe(key2);
  });

  it('data 顺序不影响 key', () => {
    const config1 = { method: 'POST', url: '/api/users', data: { a: 1, b: 2 } };
    const config2 = { method: 'POST', url: '/api/users', data: { b: 2, a: 1 } };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).toBe(key2);
  });
});

// ============================================
// createGenerateKey - 字符串模板生成 Key
// ============================================
describe('createGenerateKey - 字符串模板生成 Key', () => {

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
});

// ============================================
// normalizeGenerateKey - 标准化 Key 生成函数
// ============================================
describe('normalizeGenerateKey - 标准化 Key 生成函数', () => {

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
});

// ============================================
// TokenManager - Token 管理器
// ============================================
describe('TokenManager - Token 管理器', () => {

  describe('normalize - 静态规范化方法', () => {
    it('undefined 返回禁用', () => {
      const result = TokenManager.normalize(undefined);
      expect(result.enabled).toBe(false);
    });

    it('null 返回禁用', () => {
      const result = TokenManager.normalize(null);
      expect(result.enabled).toBe(false);
    });

    it('false 返回禁用', () => {
      const result = TokenManager.normalize(false);
      expect(result.enabled).toBe(false);
    });

    it('true 返回禁用（语义不明确）', () => {
      const result = TokenManager.normalize(true);
      expect(result.enabled).toBe(false);
    });

    it('配置对象返回启用', () => {
      const config = {
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      };
      const result = TokenManager.normalize(config);
      expect(result.enabled).toBe(true);
      expect(result.config).toBe(config);
    });
  });

  describe('isUrlWhitelisted - URL 白名单检查', () => {
    let manager: TokenManager;

    beforeEach(() => {
      manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
        whitelistUrls: ['/api/public', /^\/api\/static/],
      });
    });

    it('空白名单返回 false', () => {
      const emptyManager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });
      expect(emptyManager.isUrlWhitelisted('/api/test', [])).toBe(false);
    });

    it('字符串匹配 - 包含关系', () => {
      expect(manager.isUrlWhitelisted('/api/public/data', ['/api/public'])).toBe(true);
    });

    it('字符串匹配 - 不包含返回 false', () => {
      expect(manager.isUrlWhitelisted('/api/private/data', ['/api/public'])).toBe(false);
    });

    it('正则匹配 - 匹配成功', () => {
      expect(manager.isUrlWhitelisted('/api/static/logo.png', [/^\/api\/static\/.*/])).toBe(true);
    });

    it('正则匹配 - 匹配失败', () => {
      expect(manager.isUrlWhitelisted('/api/public/data', [/^\/api\/static\/.*/])).toBe(false);
    });

    it('多规则匹配 - 任一匹配返回 true', () => {
      const urls = ['/api/public', /^\/api\/static/];
      expect(manager.isUrlWhitelisted('/api/public/data', urls)).toBe(true);
      expect(manager.isUrlWhitelisted('/api/static/file.png', urls)).toBe(true);
    });
  });

  describe('shouldSkipToken - 是否跳过 Token', () => {
    let manager: TokenManager;

    beforeEach(() => {
      manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
        whitelistUrls: ['/api/public'],
      });
    });

    it('URL 在白名单中返回 true', () => {
      const config = { url: '/api/public/data' };
      const context = manager.createContext();
      expect(manager.shouldSkipToken(config, context)).toBe(true);
    });

    it('URL 不在白名单中返回 false', () => {
      const config = { url: '/api/private/data' };
      const context = manager.createContext();
      expect(manager.shouldSkipToken(config, context)).toBe(false);
    });
  });

  describe('isTokenExpired - Token 过期检测', () => {
    it('401 状态码返回 true', () => {
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      const error = { response: { status: 401 } };
      expect(manager.isTokenExpired(error)).toBe(true);
    });

    it('非 401 状态码返回 false', () => {
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      const error = { response: { status: 404 } };
      expect(manager.isTokenExpired(error)).toBe(false);
    });

    it('无 response 返回 false', () => {
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      expect(manager.isTokenExpired(new Error('Network Error'))).toBe(false);
    });
  });

  describe('isTokenExpiredFromResponse - 响应中检测过期', () => {
    it('配置了检测函数时调用', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        isTokenExpiredFromResponse: (response) => response?.code === 401,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      expect(manager.isTokenExpiredFromResponse({ code: 401 })).toBe(true);
      expect(manager.isTokenExpiredFromResponse({ code: 200 })).toBe(false);
    });

    it('未配置检测函数时返回 false', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      expect(manager.isTokenExpiredFromResponse({ code: 401 })).toBe(false);
    });
  });

  describe('setAuthorization - Token 赋值', () => {
    it('默认 Bearer 格式', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      const config: any = { headers: {} };
      manager.setAuthorization(config, 'my-token');
      expect(config.headers.Authorization).toBe('Bearer my-token');
    });

    it('自定义赋值方式', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
        setAuthorization: (config, token) => {
          config.headers['X-Token'] = token;
        },
      });

      const config: any = { headers: {} };
      manager.setAuthorization(config, 'my-token');
      expect(config.headers['X-Token']).toBe('my-token');
    });

    it('自动创建 headers 对象', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      const config: any = {};
      manager.setAuthorization(config, 'my-token');
      expect(config.headers.Authorization).toBe('Bearer my-token');
    });
  });

  describe('getToken - 获取 Token', () => {
    it('使用默认配置获取', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'default-token',
        setTokens: () => {},
      });

      expect(manager.getToken()).toBe('default-token');
    });

    it('使用上下文获取', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'default-token',
        setTokens: () => {},
      });

      const context = manager.createContext({
        getAccessToken: () => 'context-token',
      });

      expect(manager.getToken(context)).toBe('context-token');
    });

    it('无 token 返回 null', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => null,
        setTokens: () => {},
      });

      expect(manager.getToken()).toBe(null);
    });
  });

  describe('destroy - 销毁管理器', () => {
    it('清空队列并拒绝待处理请求', async () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      // 直接向队列添加待处理请求
      let isRejected = false;
      const promise = new Promise<void>((resolve, reject) => {
        (manager as any).requestQueue.push({
          resolve: () => resolve(),
          reject: (e: Error) => {
            isRejected = true;
            reject(e);
          },
        });
      });

      // 添加 unhandled rejection 处理器
      promise.catch(() => {});

      expect((manager as any).requestQueue.length).toBe(1);

      // 销毁管理器
      manager.destroy();

      // 队列应该被清空
      expect((manager as any).requestQueue.length).toBe(0);
      // 请求应该被拒绝
      expect(isRejected).toBe(true);
    });

    it('重置刷新状态', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      // 模拟 isRefreshing 状态
      (manager as any).isRefreshing = true;
      expect((manager as any).isRefreshing).toBe(true);

      // 销毁后状态应该重置
      manager.destroy();
      expect((manager as any).isRefreshing).toBe(false);
    });
  });
});

// ============================================
// DedupeManager - 防重复提交管理器
// ============================================
describe('DedupeManager - 防重复提交管理器', () => {

  describe('normalize - 静态规范化方法', () => {
    it('undefined + 无 defaultEnabled 返回启用（实例级默认）', () => {
      const result = DedupeManager.normalize(undefined);
      expect(result.enabled).toBe(true);
    });

    it('undefined + defaultEnabled=false 返回禁用（请求级默认）', () => {
      const result = DedupeManager.normalize(undefined, false);
      expect(result.enabled).toBe(false);
    });

    it('true 返回启用', () => {
      const result = DedupeManager.normalize(true);
      expect(result.enabled).toBe(true);
    });

    it('false 返回禁用', () => {
      const result = DedupeManager.normalize(false);
      expect(result.enabled).toBe(false);
    });

    it('数组简写 - 自动转大写', () => {
      const result = DedupeManager.normalize(['post', 'Put', 'PATCH']);
      expect(result.enabled).toBe(true);
      expect(result.config?.methods).toEqual(['POST', 'PUT', 'PATCH']);
    });

    it('字符串简写 - 作为 generateKey', () => {
      const result = DedupeManager.normalize('only-url');
      expect(result.enabled).toBe(true);
      expect(result.config?.generateKey).toBe('only-url');
    });

    it('函数简写 - 作为 generateKey', () => {
      const fn = () => 'key';
      const result = DedupeManager.normalize(fn);
      expect(result.enabled).toBe(true);
      expect(result.config?.generateKey).toBe(fn);
    });
  });

  describe('shouldDedupe - 是否应该去重', () => {
    let manager: DedupeManager;

    beforeEach(() => {
      manager = new DedupeManager({
        enabled: true,
        methods: ['POST', 'PUT'],
      });
    });

    it('启用且方法匹配返回 true', () => {
      const context = manager.createContext();
      const config = { method: 'POST', url: '/api/test' } as any;
      expect(manager.shouldDedupe(context, config)).toBe(true);
    });

    it('启用但方法不匹配返回 false', () => {
      const context = manager.createContext();
      const config = { method: 'GET', url: '/api/test' } as any;
      expect(manager.shouldDedupe(context, config)).toBe(false);
    });

    it('禁用返回 false', () => {
      const context = manager.createContext({ enabled: false });
      const config = { method: 'POST', url: '/api/test' } as any;
      expect(manager.shouldDedupe(context, config)).toBe(false);
    });

    it('小写方法自动转大写', () => {
      const context = manager.createContext();
      const config = { method: 'post', url: '/api/test' } as any;
      expect(manager.shouldDedupe(context, config)).toBe(true);
    });
  });

  describe('dedupe - 防重复提交逻辑', () => {
    let manager: DedupeManager;

    beforeEach(() => {
      manager = new DedupeManager({
        enabled: true,
        timeWindow: 1000,
        methods: ['POST'],
      });
    });

    afterEach(() => {
      manager.destroy();
    });

    it('首次请求创建 Promise', async () => {
      const context = manager.createContext();
      const config = { method: 'POST', url: '/api/test', data: {} } as any;
      let requestCount = 0;

      const makeRequest = async () => {
        requestCount++;
        return { success: true };
      };

      const result = await manager.dedupe(context, config, makeRequest);
      expect(result).toEqual({ success: true });
      expect(requestCount).toBe(1);
    });

    it('重复请求复用 Promise', async () => {
      const context = manager.createContext();
      const config = { method: 'POST', url: '/api/test', data: {} } as any;
      let requestCount = 0;

      const makeRequest = async () => {
        requestCount++;
        return { success: true };
      };

      // 发起多个相同请求
      const [result1, result2, result3] = await Promise.all([
        manager.dedupe(context, config, makeRequest),
        manager.dedupe(context, config, makeRequest),
        manager.dedupe(context, config, makeRequest),
      ]);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
      expect(result3).toEqual({ success: true });
      expect(requestCount).toBe(1); // 只发起一次请求
    });

    it('不同 data 生成不同 key（需要显式配置包含 data）', async () => {
      // 创建包含 data 的 generateKey
      const managerWithData = new DedupeManager({
        enabled: true,
        generateKey: 'method:url:data',
      });

      const context = managerWithData.createContext();
      let requestCount = 0;

      const makeRequest = async () => {
        requestCount++;
        return { success: true };
      };

      const config1 = { method: 'POST', url: '/api/test', data: { name: '张三' } } as any;
      const config2 = { method: 'POST', url: '/api/test', data: { name: '李四' } } as any;

      await Promise.all([
        managerWithData.dedupe(context, config1, makeRequest),
        managerWithData.dedupe(context, config2, makeRequest),
      ]);

      expect(requestCount).toBe(2); // 两个不同的 data，发起两次请求
    });

    it('默认配置不包含 data，相同 URL 的请求会被去重', async () => {
      // 默认的 generateKey 是 'method:url'，不包含 data
      const context = manager.createContext();
      let requestCount = 0;

      const makeRequest = async () => {
        requestCount++;
        return { success: true };
      };

      const config1 = { method: 'POST', url: '/api/test', data: { name: '张三' } } as any;
      const config2 = { method: 'POST', url: '/api/test', data: { name: '李四' } } as any;

      await Promise.all([
        manager.dedupe(context, config1, makeRequest),
        manager.dedupe(context, config2, makeRequest),
      ]);

      expect(requestCount).toBe(1); // 默认配置不包含 data，相同 URL 会被去重
    });
  });

  describe('clear - 清除待处理请求', () => {
    it('清除所有定时器', () => {
      const manager = new DedupeManager({
        enabled: true,
        timeWindow: 100,
      });

      // 发起请求创建定时器
      const context = manager.createContext();
      const config = { method: 'POST', url: '/api/test', data: {} } as any;
      const makeRequest = () => new Promise(r => setTimeout(() => r({ success: true }), 200));

      manager.dedupe(context, config, makeRequest);
      expect(() => manager.clear()).not.toThrow();

      manager.destroy();
    });
  });
});

// ============================================
// CancelManager - 请求取消管理器
// ============================================
describe('CancelManager - 请求取消管理器', () => {

  describe('normalize - 静态规范化方法', () => {
    it('undefined + 无 defaultEnabled 返回启用（实例级默认）', () => {
      const result = CancelManager.normalize(undefined);
      expect(result.enabled).toBe(true);
    });

    it('undefined + defaultEnabled=false 返回禁用（请求级默认）', () => {
      const result = CancelManager.normalize(undefined, false);
      expect(result.enabled).toBe(false);
    });

    it('true 返回启用', () => {
      const result = CancelManager.normalize(true);
      expect(result.enabled).toBe(true);
    });

    it('false 返回禁用', () => {
      const result = CancelManager.normalize(false);
      expect(result.enabled).toBe(false);
    });

    it('数组简写 - 自动转大写', () => {
      const result = CancelManager.normalize(['get', 'Get', 'POST']);
      expect(result.enabled).toBe(true);
      expect(result.config?.methods).toEqual(['GET', 'GET', 'POST']);
    });
  });

  describe('shouldCancel - 是否应该取消', () => {
    let manager: CancelManager;

    beforeEach(() => {
      manager = new CancelManager({
        enabled: true,
        methods: ['GET'],
      });
    });

    it('启用且方法匹配返回 true', () => {
      const context = manager.createContext();
      const config = { method: 'GET', url: '/api/test' } as any;
      expect(manager.shouldCancel(context, config)).toBe(true);
    });

    it('启用但方法不匹配返回 false', () => {
      const context = manager.createContext();
      const config = { method: 'POST', url: '/api/test' } as any;
      expect(manager.shouldCancel(context, config)).toBe(false);
    });

    it('禁用返回 false', () => {
      const context = manager.createContext({ enabled: false });
      const config = { method: 'GET', url: '/api/test' } as any;
      expect(manager.shouldCancel(context, config)).toBe(false);
    });
  });

  describe('setupCancel - 设置取消', () => {
    let manager: CancelManager;

    beforeEach(() => {
      manager = new CancelManager({
        enabled: true,
        methods: ['GET'],
      });
    });

    afterEach(() => {
      manager.destroy();
    });

    it('创建 AbortController 并添加到 pending', () => {
      const context = manager.createContext();
      const config = { method: 'GET', url: '/api/test' } as any;

      const newConfig = manager.setupCancel(context, config);

      expect(newConfig.signal).toBeDefined();
      expect(newConfig.signal).toBeInstanceOf(AbortSignal);
    });

    it('取消上一次的相同请求', () => {
      const context = manager.createContext();
      const config1 = { method: 'GET', url: '/api/test' } as any;
      const config2 = { method: 'GET', url: '/api/test' } as any;

      // 第一次请求
      manager.setupCancel(context, config1);

      // 第二次请求 - 应该取消第一次
      const newConfig = manager.setupCancel(context, config2);

      expect(newConfig.signal).toBeDefined();
    });

    it('不同 URL 不取消', () => {
      const context = manager.createContext();
      const config1 = { method: 'GET', url: '/api/test1' } as any;
      const config2 = { method: 'GET', url: '/api/test2' } as any;

      manager.setupCancel(context, config1);
      // 第二次请求不同 URL，不应该取消
      expect(() => manager.setupCancel(context, config2)).not.toThrow();
    });
  });

  describe('clear - 清除待处理请求', () => {
    it('取消所有请求', () => {
      const manager = new CancelManager({
        enabled: true,
        methods: ['GET'],
      });

      const context = manager.createContext();
      const config = { method: 'GET', url: '/api/test' } as any;

      manager.setupCancel(context, config);
      expect(() => manager.clear()).not.toThrow();

      manager.destroy();
    });
  });
});

// ============================================
// RetryManager - 重试管理器
// ============================================
describe('RetryManager - 重试管理器', () => {

  describe('normalize - 静态规范化方法', () => {
    it('undefined + 无 defaultEnabled 返回启用（实例级默认）', () => {
      const result = RetryManager.normalize(undefined);
      expect(result.enabled).toBe(true);
    });

    it('undefined + defaultEnabled=false 返回禁用（请求级默认）', () => {
      const result = RetryManager.normalize(undefined, false);
      expect(result.enabled).toBe(false);
    });

    it('true 返回启用', () => {
      const result = RetryManager.normalize(true);
      expect(result.enabled).toBe(true);
    });

    it('false 返回禁用', () => {
      const result = RetryManager.normalize(false);
      expect(result.enabled).toBe(false);
    });

    it('数字简写 - 设置 maxRetries', () => {
      const result = RetryManager.normalize(5);
      expect(result.enabled).toBe(true);
      expect(result.config?.maxRetries).toBe(5);
    });

    it('函数简写 - 作为 retryCondition', () => {
      const fn = () => true;
      const result = RetryManager.normalize(fn);
      expect(result.enabled).toBe(true);
      expect(result.config?.retryCondition).toBe(fn);
    });
  });

  describe('shouldRetry - 是否应该重试', () => {
    let manager: RetryManager;

    beforeEach(() => {
      manager = new RetryManager({
        enabled: true,
        maxRetries: 3,
      });
    });

    it('启用且未超过最大次数返回 true', () => {
      const context = manager.createContext();
      const config = { _retryCount: 0 } as any;
      expect(manager.shouldRetry(context, config)).toBe(true);
    });

    it('已达到最大次数返回 false', () => {
      const context = manager.createContext();
      const config = { _retryCount: 3 } as any;
      expect(manager.shouldRetry(context, config)).toBe(false);
    });

    it('禁用返回 false', () => {
      const context = manager.createContext({ enabled: false });
      const config = { _retryCount: 0 } as any;
      expect(manager.shouldRetry(context, config)).toBe(false);
    });

    it('使用上下文中的 maxRetries', () => {
      const context = manager.createContext({ maxRetries: 5 });
      const config = { _retryCount: 5 } as any;
      expect(manager.shouldRetry(context, config)).toBe(false);
    });
  });

  describe('shouldRetryOnError - 是否对特定错误重试', () => {
    let manager: RetryManager;

    beforeEach(() => {
      manager = new RetryManager({
        enabled: true,
        maxRetries: 3,
      });
    });

    it('有 retryCondition 使用自定义条件', () => {
      const context = manager.createContext({
        retryCondition: () => true,
      });
      expect(manager.shouldRetryOnError(context, {}, 0)).toBe(true);
    });

    it('无 retryCondition - 网络错误默认重试', () => {
      const context = manager.createContext();
      const error = new Error('Network Error');
      expect(manager.shouldRetryOnError(context, error, 0)).toBe(true);
    });

    it('无 retryCondition - 5xx 错误默认重试', () => {
      const context = manager.createContext();
      const error = { response: { status: 500 } };
      expect(manager.shouldRetryOnError(context, error, 0)).toBe(true);
    });

    it('无 retryCondition - 4xx 错误默认不重试', () => {
      const context = manager.createContext();
      const error = { response: { status: 400 } };
      expect(manager.shouldRetryOnError(context, error, 0)).toBe(false);
    });

    it('4xx 错误不重试', () => {
      const context = manager.createContext();
      const error = { response: { status: 404 } };
      expect(manager.shouldRetryOnError(context, error, 0)).toBe(false);
    });
  });

  describe('calculateDelay - 计算延迟', () => {
    it('指数退避关闭 - 固定延迟', () => {
      const manager = new RetryManager({
        enabled: true,
        retryDelay: 100,
        exponentialBackoff: false,
      });
      const context = manager.createContext();

      expect(manager.calculateDelay(context, 0)).toBe(100);
      expect(manager.calculateDelay(context, 1)).toBe(100);
      expect(manager.calculateDelay(context, 2)).toBe(100);
    });

    it('指数退避开启 - 延迟指数增长', () => {
      const manager = new RetryManager({
        enabled: true,
        retryDelay: 100,
        exponentialBackoff: true,
      });
      const context = manager.createContext();

      expect(manager.calculateDelay(context, 0)).toBe(100);
      expect(manager.calculateDelay(context, 1)).toBe(200);
      expect(manager.calculateDelay(context, 2)).toBe(400);
      expect(manager.calculateDelay(context, 3)).toBe(800);
    });
  });

  describe('retry - 执行重试', () => {
    let manager: RetryManager;

    beforeEach(() => {
      manager = new RetryManager({
        enabled: true,
        maxRetries: 3,
        retryDelay: 10,
      });
    });

    afterEach(() => {
      manager.destroy();
    });

    it('等待延迟后执行请求', async () => {
      const context = manager.createContext();
      const config = { url: '/api/test' } as any;
      let callCount = 0;

      const makeRequest = async () => {
        callCount++;
        return { success: true };
      };

      const result = await manager.retry(context, config, makeRequest, 0);

      expect(result).toEqual({ success: true });
      expect(callCount).toBe(1);
    });

    it('增加重试计数', async () => {
      const context = manager.createContext();
      let lastRetryCount = -1;

      const makeRequest = async (config: any) => {
        lastRetryCount = config._retryCount;
        return { success: true };
      };

      await manager.retry(context, { url: '/api/test' } as any, makeRequest, 2);

      expect(lastRetryCount).toBe(3);
    });
  });

  describe('destroy - 销毁', () => {
    it('清除所有定时器', () => {
      const manager = new RetryManager({
        enabled: true,
        retryDelay: 100,
      });

      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============================================
// ManagerRegistry - 管理器注册表
// ============================================
describe('ManagerRegistry - 管理器注册表', () => {

  describe('默认配置', () => {
    it('无配置创建实例', () => {
      const client = new AxiosRequest({});
      expect(client).toBeDefined();
    });

    it('Dedupe/Cancel/Retry 默认开启', () => {
      const client = new AxiosRequest({});
      expect(client).toBeDefined();
      // 默认配置应该可用
      expect(typeof client.clear).toBe('function');
    });
  });

  describe('实例级管理器', () => {
    it('实例级 Token 配置', () => {
      const client = new AxiosRequest({
        token: {
          isTokenExpired: (error) => error.response?.status === 401,
          refreshToken: async () => ({ accessToken: 'new-token' }),
          getAccessToken: () => 'token',
          setTokens: () => {},
        },
      });
      expect(client).toBeDefined();
    });

    it('实例级 Dedupe 配置', () => {
      const client = new AxiosRequest({
        dedupe: {
          enabled: true,
          timeWindow: 2000,
        },
      });
      expect(client).toBeDefined();
    });

    it('实例级 Cancel 配置', () => {
      const client = new AxiosRequest({
        cancel: {
          enabled: true,
          methods: ['GET', 'POST'],
        },
      });
      expect(client).toBeDefined();
    });

    it('实例级 Retry 配置', () => {
      const client = new AxiosRequest({
        retry: {
          enabled: true,
          maxRetries: 5,
        },
      });
      expect(client).toBeDefined();
    });
  });

  describe('混用配置', () => {
    it('简写和完整配置混用', () => {
      const client = new AxiosRequest({
        dedupe: false,
        cancel: true,
        retry: 3,
      });
      expect(client).toBeDefined();
    });

    it('同时配置所有管理器', () => {
      const client = new AxiosRequest({
        token: {
          isTokenExpired: (error) => error.response?.status === 401,
          refreshToken: async () => ({ accessToken: 'new-token' }),
          getAccessToken: () => 'token',
          setTokens: () => {},
        },
        dedupe: { timeWindow: 1000 },
        cancel: { methods: ['GET'] },
        retry: { maxRetries: 3 },
      });
      expect(client).toBeDefined();
    });
  });
});

// ============================================
// 实例方法
// ============================================
describe('实例方法', () => {

  it('clear 方法存在且可调用', () => {
    const client = new AxiosRequest({});
    expect(typeof client.clear).toBe('function');
    expect(() => client.clear()).not.toThrow();
  });

  it('destroy 方法存在且可调用', () => {
    const client = new AxiosRequest({});
    expect(typeof client.destroy).toBe('function');
    expect(() => client.destroy()).not.toThrow();
  });

  it('getInstanceConfig 方法存在', () => {
    const client = new AxiosRequest({
      baseURL: 'https://api.example.com',
      timeout: 5000,
    });
    expect(typeof client.getInstanceConfig).toBe('function');

    const config = client.getInstanceConfig();
    expect(config.baseURL).toBe('https://api.example.com');
    expect(config.timeout).toBe(5000);
  });

  it('getInstanceConfig 返回副本，不影响原配置', () => {
    const client = new AxiosRequest({
      baseURL: 'https://api.example.com',
    });

    const config1 = client.getInstanceConfig();
    config1.baseURL = 'https://changed.com';

    const config2 = client.getInstanceConfig();
    expect(config2.baseURL).toBe('https://api.example.com');
  });

  it('setTokenManager 方法存在', () => {
    const client = new AxiosRequest({});
    expect(typeof client.setTokenManager).toBe('function');
  });

  it('getInstance 方法返回 axios 实例', () => {
    const client = new AxiosRequest({});
    const instance = client.getInstance();
    expect(instance).toBeDefined();
  });
});

// ============================================
// Content-Type 处理
// ============================================
describe('Content-Type 处理', () => {
  it('默认配置', () => {
    const client = new AxiosRequest({});
    expect(client).toBeDefined();
  });
});

// ============================================
// HTTP 方法
// ============================================
describe('HTTP 方法', () => {
  it('所有 HTTP 方法存在', () => {
    const client = new AxiosRequest({});

    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.head).toBe('function');
    expect(typeof client.options).toBe('function');
    expect(typeof client.request).toBe('function');
  });
});

// ============================================
// 导出的管理器类
// ============================================
describe('导出的管理器类', () => {
  it('TokenManager 可导入', async () => {
    const { TokenManager } = await import('../src');
    expect(TokenManager).toBeDefined();
  });

  it('DedupeManager 可导入', async () => {
    const { DedupeManager } = await import('../src');
    expect(DedupeManager).toBeDefined();
  });

  it('CancelManager 可导入', async () => {
    const { CancelManager } = await import('../src');
    expect(CancelManager).toBeDefined();
  });

  it('RetryManager 可导入', async () => {
    const { RetryManager } = await import('../src');
    expect(RetryManager).toBeDefined();
  });
});
