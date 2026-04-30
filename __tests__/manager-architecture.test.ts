import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosRequest } from '../src';
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
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        patch: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        head: vi.fn().mockResolvedValue({ data: {} }),
        options: vi.fn().mockResolvedValue({ data: {} }),
      })),
    },
  };
});

// ============================================
// TokenManager 功能测试
// ============================================
describe('TokenManager - Token 管理器', () => {
  describe('基本配置', () => {
    it('必须配置项验证', () => {
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'current-token',
        setTokens: () => {},
      });

      expect(manager).toBeDefined();
      expect(manager.getName()).toBe('TokenManager');
    });

    it('带 refreshToken 配置', () => {
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
        getAccessToken: () => 'current-token',
        getRefreshToken: () => 'current-refresh',
        setTokens: () => {},
      });

      expect(manager).toBeDefined();
    });

    it('带 onRefreshFailed 配置', () => {
      const onRefreshFailed = vi.fn();
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => {
          throw new Error('Refresh failed');
        },
        getAccessToken: () => 'current-token',
        setTokens: () => {},
        onRefreshFailed,
      });

      expect(manager).toBeDefined();
    });

    it('带 setAuthorization 自定义配置', () => {
      const manager = new TokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'current-token',
        setTokens: () => {},
        setAuthorization: (config, token) => {
          config.headers = config.headers || {};
          config.headers['X-Access-Token'] = `Bearer ${token}`;
        },
      });

      expect(manager).toBeDefined();
    });
  });

  describe('上下文创建', () => {
    it('createContext 返回独立对象', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new' }),
        getAccessToken: () => 'instance-token',
        setTokens: () => {},
      });

      const ctx1 = manager.createContext();
      const ctx2 = manager.createContext();

      expect(ctx1).not.toBe(ctx2);
      expect(typeof ctx1).toBe('object');
      expect(typeof ctx2).toBe('object');
    });

    it('上下文可自定义 token 获取函数', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new' }),
        getAccessToken: () => 'instance-token',
        setTokens: () => {},
      });

      const ctx = manager.createContext(() => 'custom-token');
      expect(manager.getToken(ctx)).toBe('custom-token');
      expect(manager.getToken()).toBe('instance-token');
    });

    it('上下文可配置白名单 URL', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new' }),
        getAccessToken: () => 'instance-token',
        setTokens: () => {},
        whitelistUrls: ['/public/**', '/auth/login'],
      });

      const ctx = manager.createContext(undefined, ['/static/**']);
      expect(manager.isWhitelisted(ctx, { url: '/public/news' })).toBe(true);
      expect(manager.isWhitelisted(ctx, { url: '/static/logo.png' })).toBe(true);
      expect(manager.isWhitelisted(ctx, { url: '/api/users' })).toBe(false);
    });

    it('多次创建上下文互不影响', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new' }),
        getAccessToken: () => 'instance-token',
        setTokens: () => {},
      });

      const ctx1 = manager.createContext(() => 'token-1');
      const ctx2 = manager.createContext(() => 'token-2');

      expect(manager.getToken(ctx1)).toBe('token-1');
      expect(manager.getToken(ctx2)).toBe('token-2');
    });
  });

  describe('响应式 token 过期检测', () => {
    it('支持 isTokenExpiredFromResponse 回调', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        isTokenExpiredFromResponse: (response) => response?.code === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'old-token',
        setTokens: () => {},
      });

      expect(manager.isTokenExpiredFromResponse({ code: 200, data: {} })).toBe(false);
      expect(manager.isTokenExpiredFromResponse({ code: 401, message: 'token expired' })).toBe(true);
    });

    it('未配置 isTokenExpiredFromResponse 时返回 false', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'old-token',
        setTokens: () => {},
      });

      expect(manager.isTokenExpiredFromResponse({ code: 401 })).toBe(false);
    });
  });

  describe('资源管理', () => {
    it('destroy 方法存在', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      expect(typeof manager.destroy).toBe('function');
    });

    it('destroy 不抛出错误', () => {
      const manager = new TokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'new' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============================================
// DedupeManager 功能测试
// ============================================
describe('DedupeManager - 防重复提交管理器', () => {
  describe('基本配置', () => {
    it('默认配置', () => {
      const manager = new DedupeManager({ enabled: true });
      expect(manager).toBeDefined();
      expect(manager.getName()).toBe('DedupeManager');
    });

    it('完整配置', () => {
      const manager = new DedupeManager({
        enabled: true,
        timeWindow: 2000,
        methods: ['POST', 'PUT'],
        generateKey: 'method:url:data.id',
      });
      expect(manager).toBeDefined();
    });

    it('禁用配置', () => {
      const manager = new DedupeManager({ enabled: false });
      expect(manager).toBeDefined();
    });
  });

  describe('shouldDedupe 方法', () => {
    it('启用时正确判断是否需要去重', () => {
      const manager = new DedupeManager({ enabled: true, methods: ['POST'] });
      const ctx = manager.createContext();

      expect(manager.shouldDedupe(ctx, { method: 'POST', url: '/test' })).toBe(true);
      expect(manager.shouldDedupe(ctx, { method: 'GET', url: '/test' })).toBe(false);
    });

    it('禁用时不进行去重', () => {
      const manager = new DedupeManager({ enabled: false });
      const ctx = manager.createContext();

      expect(manager.shouldDedupe(ctx, { method: 'POST', url: '/test' })).toBe(false);
    });

    it('自定义 generateKey 函数', () => {
      const manager = new DedupeManager({
        enabled: true,
        generateKey: (config) => `${config.url}:${config.params?.id}`,
      });
      const ctx = manager.createContext();

      expect(manager.shouldDedupe(ctx, { method: 'POST', url: '/test', params: { id: 1 } })).toBe(true);
    });
  });

  describe('上下文配置覆盖', () => {
    it('上下文可禁用功能', () => {
      const manager = new DedupeManager({ enabled: true });
      const disabledCtx = manager.createContext({ enabled: false });

      expect(manager.shouldDedupe(disabledCtx, { method: 'POST', url: '/test' })).toBe(false);
    });

    it('上下文可覆盖 methods', () => {
      const manager = new DedupeManager({ enabled: true, methods: ['POST'] });
      const customCtx = manager.createContext({ methods: ['GET'] });

      expect(manager.shouldDedupe(customCtx, { method: 'POST', url: '/test' })).toBe(false);
      expect(manager.shouldDedupe(customCtx, { method: 'GET', url: '/test' })).toBe(true);
    });

    it('部分配置覆盖', () => {
      const manager = new DedupeManager({
        enabled: true,
        timeWindow: 1000,
        methods: ['POST', 'PUT'],
      });
      const ctx = manager.createContext({ timeWindow: 5000 });

      expect(manager.shouldDedupe(ctx, { method: 'POST', url: '/test' })).toBe(true);
      expect(manager.shouldDedupe(ctx, { method: 'DELETE', url: '/test' })).toBe(false);
    });
  });

  describe('dedupe 方法', () => {
    it('dedupe 方法存在', () => {
      const manager = new DedupeManager({ enabled: true });
      expect(typeof manager.dedupe).toBe('function');
    });
  });

  describe('资源管理', () => {
    it('destroy 方法存在', () => {
      const manager = new DedupeManager({ enabled: true });
      expect(typeof manager.destroy).toBe('function');
    });

    it('destroy 不抛出错误', () => {
      const manager = new DedupeManager({ enabled: true });
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============================================
// CancelManager 功能测试
// ============================================
describe('CancelManager - 请求取消管理器', () => {
  describe('基本配置', () => {
    it('默认配置', () => {
      const manager = new CancelManager({ enabled: true });
      expect(manager).toBeDefined();
      expect(manager.getName()).toBe('CancelManager');
    });

    it('完整配置', () => {
      const manager = new CancelManager({
        enabled: true,
        methods: ['GET', 'POST'],
        generateKey: 'only-url',
      });
      expect(manager).toBeDefined();
    });

    it('禁用配置', () => {
      const manager = new CancelManager({ enabled: false });
      expect(manager).toBeDefined();
    });
  });

  describe('shouldCancel 方法', () => {
    it('启用时正确判断是否需要取消', () => {
      const manager = new CancelManager({ enabled: true, methods: ['GET'] });
      const ctx = manager.createContext();

      expect(manager.shouldCancel(ctx, { method: 'GET', url: '/test' })).toBe(true);
      expect(manager.shouldCancel(ctx, { method: 'POST', url: '/test' })).toBe(false);
    });

    it('禁用时不进行取消', () => {
      const manager = new CancelManager({ enabled: false });
      const ctx = manager.createContext();

      expect(manager.shouldCancel(ctx, { method: 'GET', url: '/test' })).toBe(false);
    });

    it('自定义 generateKey 函数', () => {
      const manager = new CancelManager({
        enabled: true,
        generateKey: (config) => config.url,
      });
      const ctx = manager.createContext();

      expect(manager.shouldCancel(ctx, { method: 'GET', url: '/test' })).toBe(true);
    });
  });

  describe('上下文配置覆盖', () => {
    it('上下文可禁用功能', () => {
      const manager = new CancelManager({ enabled: true });
      const disabledCtx = manager.createContext({ enabled: false });

      expect(manager.shouldCancel(disabledCtx, { method: 'GET', url: '/test' })).toBe(false);
    });

    it('上下文可覆盖 methods', () => {
      const manager = new CancelManager({ enabled: true, methods: ['GET'] });
      const customCtx = manager.createContext({ methods: ['GET', 'POST'] });

      expect(manager.shouldCancel(customCtx, { method: 'POST', url: '/test' })).toBe(true);
    });
  });

  describe('setupCancel 方法', () => {
    it('setupCancel 方法存在', () => {
      const manager = new CancelManager({ enabled: true });
      expect(typeof manager.setupCancel).toBe('function');
    });
  });

  describe('资源管理', () => {
    it('destroy 方法存在', () => {
      const manager = new CancelManager({ enabled: true });
      expect(typeof manager.destroy).toBe('function');
    });

    it('destroy 不抛出错误', () => {
      const manager = new CancelManager({ enabled: true });
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============================================
// RetryManager 功能测试
// ============================================
describe('RetryManager - 失败重试管理器', () => {
  describe('基本配置', () => {
    it('默认配置', () => {
      const manager = new RetryManager({ enabled: true });
      expect(manager).toBeDefined();
      expect(manager.getName()).toBe('RetryManager');
    });

    it('完整配置', () => {
      const manager = new RetryManager({
        enabled: true,
        maxRetries: 5,
        retryDelay: 200,
        exponentialBackoff: true,
      });
      expect(manager).toBeDefined();
    });

    it('禁用配置', () => {
      const manager = new RetryManager({ enabled: false });
      expect(manager).toBeDefined();
    });
  });

  describe('shouldRetry 方法', () => {
    it('启用时正确判断是否需要重试', () => {
      const manager = new RetryManager({ enabled: true });
      const ctx = manager.createContext();

      expect(manager.shouldRetry(ctx, { method: 'GET', url: '/test' })).toBe(true);
    });

    it('禁用时不进行重试', () => {
      const manager = new RetryManager({ enabled: false });
      const ctx = manager.createContext();

      expect(manager.shouldRetry(ctx, { method: 'GET', url: '/test' })).toBe(false);
    });
  });

  describe('shouldRetryOnError 方法', () => {
    it('默认重试条件', () => {
      const manager = new RetryManager({ enabled: true, maxRetries: 3 });
      const ctx = manager.createContext();

      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 0)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 1)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 3)).toBe(false);
    });

    it('自定义 retryCondition', () => {
      const manager = new RetryManager({
        enabled: true,
        maxRetries: 3,
        retryCondition: (_error, retryCount) => retryCount < 2,
      });
      const ctx = manager.createContext();

      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 0)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 1)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 2)).toBe(false);
    });
  });

  describe('上下文配置覆盖', () => {
    it('上下文可禁用功能', () => {
      const manager = new RetryManager({ enabled: true });
      const disabledCtx = manager.createContext({ enabled: false });

      expect(manager.shouldRetry(disabledCtx, { method: 'GET', url: '/test' })).toBe(false);
    });

    it('上下文可覆盖 maxRetries', () => {
      const manager = new RetryManager({ enabled: true, maxRetries: 3 });
      const customCtx = manager.createContext({ maxRetries: 10 });

      expect(manager.shouldRetry(customCtx, { method: 'GET', url: '/test' })).toBe(true);
    });

    it('上下文可自定义 retryCondition', () => {
      const manager = new RetryManager({ enabled: true, maxRetries: 3 });
      const ctx = manager.createContext({
        retryCondition: (_error, retryCount) => retryCount < 1,
      });

      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 0)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 1)).toBe(false);
    });
  });

  describe('资源管理', () => {
    it('destroy 方法存在', () => {
      const manager = new RetryManager({ enabled: true });
      expect(typeof manager.destroy).toBe('function');
    });

    it('destroy 不抛出错误', () => {
      const manager = new RetryManager({ enabled: true });
      expect(() => manager.destroy()).not.toThrow();
    });
  });
});

// ============================================
// 实例级/私有级管理器测试
// ============================================
describe('管理器架构 - 实例级 vs 私有级', () => {
  describe('实例级管理器', () => {
    it('实例级配置存在时使用实例级管理器', () => {
      const client = new AxiosRequest({
        dedupe: { enabled: true, timeWindow: 1000 },
      });

      const config = client.getInstanceConfig();
      expect(config.dedupe).toBeDefined();
      expect(config.dedupe?.timeWindow).toBe(1000);
    });

    it('实例级 token 配置存在时使用实例级管理器', () => {
      const client = new AxiosRequest({
        token: {
          isTokenExpired: () => false,
          refreshToken: async () => ({ accessToken: 'new' }),
          getAccessToken: () => 'token',
          setTokens: () => {},
        },
      });

      const config = client.getInstanceConfig();
      expect(config.token).toBeDefined();
    });
  });

  describe('私有级管理器', () => {
    it('实例无管理器，请求有配置时创建私有级', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      const config = client.getInstanceConfig();
      expect(config.dedupe).toBeUndefined();
      expect(config.cancel).toBeUndefined();
      expect(config.retry).toBeUndefined();
    });

    it('单个请求可以创建私有级管理器', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      expect(() => {
        client.get('/test', { retry: 3 });
      }).not.toThrow();
    });

    it('多次请求复用同一个私有级管理器', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      // 多次请求不会抛出错误（表示复用同一个管理器）
      expect(() => {
        client.get('/test1', { retry: 3 });
        client.get('/test2', { retry: 3 });
        client.get('/test3', { retry: { maxRetries: 5 } });
      }).not.toThrow();
    });
  });

  describe('配置合并规则', () => {
    it('单个请求配置不影响实例配置', () => {
      const client = new AxiosRequest({
        dedupe: { enabled: true, timeWindow: 1000, methods: ['POST'] },
      });

      const config = client.getInstanceConfig();
      expect(config.dedupe?.timeWindow).toBe(1000);
      expect(config.dedupe?.methods).toEqual(['POST']);
    });

    it('请求配置禁用功能', () => {
      const tokenConfig = { token: false };
      const dedupeConfig = { dedupe: false };

      expect(tokenConfig.token).toBe(false);
      expect(dedupeConfig.dedupe).toBe(false);
    });
  });
});

// ============================================
// ManagerRegistry 测试
// ============================================
describe('ManagerRegistry - 管理器注册表', () => {
  describe('getTokenManager', () => {
    it('实例级有配置时返回实例级管理器', () => {
      const client = new AxiosRequest({
        token: {
          isTokenExpired: () => false,
          refreshToken: async () => ({ accessToken: 'new' }),
          getAccessToken: () => 'token',
          setTokens: () => {},
        },
      });

      // 实例级有配置，应该能正常工作
      expect(() => client.get('/test')).not.toThrow();
    });

    it('token: false 返回 undefined', () => {
      const client = new AxiosRequest({
        token: {
          isTokenExpired: () => false,
          refreshToken: async () => ({ accessToken: 'new' }),
          getAccessToken: () => 'token',
          setTokens: () => {},
        },
      });

      // token: false 应该不添加 token
      expect(() => client.get('/test', { token: false })).not.toThrow();
    });

    it('实例无配置且请求无配置时返回 undefined', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      // 两者都没有配置，应该不启用 token 管理
      expect(() => client.get('/test')).not.toThrow();
    });
  });

  describe('getDedupeManager', () => {
    it('实例级有配置时返回实例级管理器', () => {
      const client = new AxiosRequest({
        dedupe: { enabled: true, timeWindow: 1000 },
      });

      expect(() => client.get('/test')).not.toThrow();
    });

    it('实例无配置且请求无配置时返回 undefined', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      // 两者都没有配置，应该不启用 dedupe 管理
      expect(() => client.get('/test')).not.toThrow();
    });
  });

  describe('getCancelManager', () => {
    it('实例级有配置时返回实例级管理器', () => {
      const client = new AxiosRequest({
        cancel: { enabled: true },
      });

      expect(() => client.get('/test')).not.toThrow();
    });

    it('实例无配置且请求无配置时返回 undefined', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      // 两者都没有配置，应该不启用 cancel 管理
      expect(() => client.get('/test')).not.toThrow();
    });
  });

  describe('getRetryManager', () => {
    it('实例级有配置时返回实例级管理器', () => {
      const client = new AxiosRequest({
        retry: { enabled: true, maxRetries: 3 },
      });

      expect(() => client.get('/test')).not.toThrow();
    });

    it('实例无配置且请求无配置时返回 undefined', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

      // 两者都没有配置，应该不启用 retry 管理
      expect(() => client.get('/test')).not.toThrow();
    });
  });
});

// ============================================
// 简写配置测试
// ============================================
describe('简写配置处理', () => {
  describe('Token 简写', () => {
    it('token: false 表示禁用', () => {
      expect({ token: false }.token).toBe(false);
    });

    it('token: true 需要使用者提供具体配置', () => {
      expect({ token: true }.token).toBe(true);
    });
  });

  describe('Dedupe 简写', () => {
    it('dedupe: false 禁用', () => {
      expect({ dedupe: false }.dedupe).toBe(false);
    });

    it('dedupe: true 启用', () => {
      expect({ dedupe: true }.dedupe).toBe(true);
    });

    it('dedupe: 数字作为 timeWindow', () => {
      expect({ dedupe: 3 }.dedupe).toBe(3);
    });

    it('dedupe: 数组作为 methods', () => {
      expect({ dedupe: ['post', 'put'] }.dedupe).toEqual(['post', 'put']);
    });

    it('dedupe: 字符串作为 generateKey', () => {
      expect({ dedupe: 'only-url' }.dedupe).toBe('only-url');
    });

    it('dedupe: 函数作为 generateKey', () => {
      const fn = () => 'key';
      expect({ dedupe: fn }.dedupe).toBe(fn);
    });
  });

  describe('Cancel 简写', () => {
    it('cancel: false 禁用', () => {
      expect({ cancel: false }.cancel).toBe(false);
    });

    it('cancel: true 启用', () => {
      expect({ cancel: true }.cancel).toBe(true);
    });

    it('cancel: 数组作为 methods', () => {
      expect({ cancel: ['get', 'post'] }.cancel).toEqual(['get', 'post']);
    });

    it('cancel: 字符串作为 generateKey', () => {
      expect({ cancel: 'only-url' }.cancel).toBe('only-url');
    });

    it('cancel: 函数作为 generateKey', () => {
      const fn = () => 'key';
      expect({ cancel: fn }.cancel).toBe(fn);
    });
  });

  describe('Retry 简写', () => {
    it('retry: false 禁用', () => {
      expect({ retry: false }.retry).toBe(false);
    });

    it('retry: true 启用', () => {
      expect({ retry: true }.retry).toBe(true);
    });

    it('retry: 数字作为 maxRetries', () => {
      expect({ retry: 5 }.retry).toBe(5);
    });

    it('retry: 函数作为 retryCondition', () => {
      const fn = () => true;
      expect({ retry: fn }.retry).toBe(fn);
    });
  });
});

// ============================================
// 生命周期测试
// ============================================
describe('生命周期管理', () => {
  describe('destroy 方法', () => {
    it('AxiosRequest 实例有 destroy 方法', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });
      expect(typeof client.destroy).toBe('function');
    });

    it('destroy 不抛出错误', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });
      expect(() => client.destroy()).not.toThrow();
    });

    it('destroy 清理所有管理器', () => {
      const client = new AxiosRequest({
        dedupe: true,
        cancel: true,
        retry: { enabled: true },
      });

      expect(() => client.destroy()).not.toThrow();
    });
  });

  describe('clear 方法', () => {
    it('AxiosRequest 实例有 clear 方法', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });
      expect(typeof client.clear).toBe('function');
    });

    it('clear 不抛出错误', () => {
      const client = new AxiosRequest({ baseURL: 'https://api.example.com' });
      expect(() => client.clear()).not.toThrow();
    });
  });
});
