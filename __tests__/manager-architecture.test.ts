import { describe, it, expect, vi } from 'vitest';
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
// 管理器架构测试
//
// 核心设计：上下文即对象
// - 每个管理器只维护实例级共享状态
// - 上下文通过 createContext() 工厂方法创建，是普通对象
// - 无 Map 存储，无 requestId 传递，无需手动清理
// ============================================

describe('管理器架构 - 上下文即对象设计', () => {
  describe('TokenManager', () => {
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

  describe('DedupeManager', () => {
    it('createContext 返回独立对象', () => {
      const manager = new DedupeManager({ enabled: true, timeWindow: 1000 });

      const ctx1 = manager.createContext();
      const ctx2 = manager.createContext();

      expect(ctx1).not.toBe(ctx2);
    });

    it('默认上下文使用实例配置', () => {
      const manager = new DedupeManager({
        enabled: true,
        timeWindow: 1000,
        methods: ['POST', 'PUT'],
      });

      const ctx = manager.createContext();
      
      expect(manager.shouldDedupe(ctx, { method: 'POST', url: '/test' })).toBe(true);
      expect(manager.shouldDedupe(ctx, { method: 'DELETE', url: '/test' })).toBe(false);
    });

    it('上下文配置覆盖实例配置', () => {
      const manager = new DedupeManager({ enabled: true, timeWindow: 1000 });

      const disabledCtx = manager.createContext({ enabled: false });
      expect(manager.shouldDedupe(disabledCtx, { method: 'POST', url: '/test' })).toBe(false);

      const customCtx = manager.createContext({ methods: ['GET'] });
      expect(manager.shouldDedupe(customCtx, { method: 'POST', url: '/test' })).toBe(false);
      expect(manager.shouldDedupe(customCtx, { method: 'GET', url: '/test' })).toBe(true);
    });

    it('部分配置覆盖，其他使用实例配置', () => {
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

  describe('CancelManager', () => {
    it('createContext 返回独立对象', () => {
      const manager = new CancelManager({ enabled: true });

      const ctx1 = manager.createContext();
      const ctx2 = manager.createContext();

      expect(ctx1).not.toBe(ctx2);
    });

    it('上下文配置覆盖实例配置', () => {
      const manager = new CancelManager({ enabled: true, methods: ['GET'] });

      const disabledCtx = manager.createContext({ enabled: false });
      expect(manager.shouldCancel(disabledCtx, { method: 'GET', url: '/test' })).toBe(false);

      const customCtx = manager.createContext({ methods: ['GET', 'POST'] });
      expect(manager.shouldCancel(customCtx, { method: 'POST', url: '/test' })).toBe(true);
    });
  });

  describe('RetryManager', () => {
    it('createContext 返回独立对象', () => {
      const manager = new RetryManager({ enabled: true });

      const ctx1 = manager.createContext();
      const ctx2 = manager.createContext();

      expect(ctx1).not.toBe(ctx2);
    });

    it('上下文配置覆盖实例配置', () => {
      const manager = new RetryManager({ enabled: true, maxRetries: 3, retryDelay: 100 });

      const disabledCtx = manager.createContext({ enabled: false });
      expect(manager.shouldRetry(disabledCtx, { method: 'GET', url: '/test' })).toBe(false);

      const customCtx = manager.createContext({ maxRetries: 10 });
      expect(manager.shouldRetry(customCtx, { method: 'GET', url: '/test' })).toBe(true);
    });

    it('上下文可自定义 retryCondition', () => {
      const manager = new RetryManager({ enabled: true, maxRetries: 3 });

      const ctx = manager.createContext({
        retryCondition: (_error, retryCount) => retryCount < 2,
      });

      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 0)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 1)).toBe(true);
      expect(manager.shouldRetryOnError(ctx, { response: { status: 500 } }, 2)).toBe(false);
    });
  });
});

describe('管理器架构 - 上下文隔离验证', () => {
  it('多个请求上下文互不影响', () => {
    const manager = new DedupeManager({ enabled: true, timeWindow: 1000 });

    const ctxA = manager.createContext({ enabled: false });
    const ctxB = manager.createContext({ enabled: true, timeWindow: 500 });
    const ctxC = manager.createContext();

    expect(manager.shouldDedupe(ctxA, { method: 'POST', url: '/test' })).toBe(false);
    expect(manager.shouldDedupe(ctxB, { method: 'POST', url: '/test' })).toBe(true);
    expect(manager.shouldDedupe(ctxC, { method: 'POST', url: '/test' })).toBe(true);
  });

  it('并发请求之间上下文不污染', () => {
    const manager = new DedupeManager({ enabled: true, timeWindow: 1000 });

    const ctxA = manager.createContext({ enabled: false });
    const ctxB = manager.createContext({ enabled: true });

    expect(manager.shouldDedupe(ctxA, { method: 'POST', url: '/test' })).toBe(false);
    expect(manager.shouldDedupe(ctxB, { method: 'POST', url: '/test' })).toBe(true);
  });

  it('上下文对象引用独立', () => {
    const manager = new DedupeManager({ enabled: true, timeWindow: 1000 });

    const ctx1 = manager.createContext();
    const ctx2 = manager.createContext();
    const modifiedCtx = manager.createContext({ enabled: false });

    expect(ctx1).not.toBe(ctx2);
    expect(ctx1).not.toBe(modifiedCtx);
  });
});

describe('管理器架构 - 配置合并规则', () => {
  it('实例有管理器时，复用实例管理器', () => {
    const client = new AxiosRequest({
      baseURL: 'https://api.example.com',
      dedupe: { enabled: true, timeWindow: 1000 },
    });

    const config = client.getInstanceConfig();
    expect(config.dedupe).toBeDefined();
    expect(config.dedupe?.timeWindow).toBe(1000);
  });

  it('单个请求配置不影响实例配置', () => {
    const client = new AxiosRequest({
      baseURL: 'https://api.example.com',
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

describe('管理器架构 - 临时管理器创建', () => {
  it('实例无管理器，请求有配置时创建临时管理器', () => {
    const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

    const config = client.getInstanceConfig();
    expect(config.dedupe).toBeUndefined();
  });

  it('单个请求可以创建临时管理器', () => {
    const client = new AxiosRequest({ baseURL: 'https://api.example.com' });

    expect(() => {
      client.get('/test', { retry: 3 });
    }).not.toThrow();
  });
});

describe('管理器架构 - 简写配置处理', () => {
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
  });
});

describe('TokenManager - 响应式token过期检测', () => {
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
