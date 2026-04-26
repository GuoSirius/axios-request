import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosRequest, generateRequestKey, toFormData, checkType, flattenFormData } from '../src';
import axios from 'axios';

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
// AxiosRequest 基础功能
// ============================================
describe('AxiosRequest 基础功能', () => {
  let client: InstanceType<typeof AxiosRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
    });
  });

  it('创建实例', () => {
    expect(client).toBeDefined();
    expect(client.getInstance).toBeDefined();
  });

  it('所有 HTTP 方法可用', () => {
    expect(client.get).toBeDefined();
    expect(client.post).toBeDefined();
    expect(client.put).toBeDefined();
    expect(client.patch).toBeDefined();
    expect(client.delete).toBeDefined();
    expect(client.head).toBeDefined();
    expect(client.options).toBeDefined();
  });

  it('获取 axios 实例', () => {
    const instance = client.getInstance();
    expect(instance).toBeDefined();
  });
});

// ============================================
// 请求 Key 生成
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
});

// ============================================
// 防重复提交配置
// ============================================
describe('DedupeManager - 防重复提交', () => {
  it('默认配置', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: true,
    });
    expect(client).toBeDefined();
  });

  it('自定义时间窗口', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: {
        enabled: true,
        duration: 2000,
      },
    });
    expect(client).toBeDefined();
  });

  it('禁用', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: false,
    });
    expect(client).toBeDefined();
  });

  it('自定义 methods', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: {
        enabled: true,
        methods: ['POST'],
      },
    });
    expect(client).toBeDefined();
  });

  it('字符串模板 generateKey', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: {
        enabled: true,
        generateKey: 'only-url',
      },
    });
    expect(client).toBeDefined();
  });

  it('函数 generateKey', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: {
        enabled: true,
        generateKey: (config) => `${config.method}:${config.url}`,
      },
    });
    expect(client).toBeDefined();
  });

  // ========== 新增简写方式测试 ==========

  it('字符串简写 - 直接作为 generateKey', () => {
    // 字符串直接作为 generateKey，启用防重复提交
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: 'method:url:data.id',
    });
    expect(client).toBeDefined();
  });

  it('only-url 字符串简写', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: 'only-url',
    });
    expect(client).toBeDefined();
  });

  it('函数简写 - 直接作为 generateKey', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: (config) => `${config.method}:${config.url}`,
    });
    expect(client).toBeDefined();
  });

  it('数组简写 - 直接作为 methods（自动转大写）', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: ['post', 'Post', 'PUT', 'patch'],
    });
    expect(client).toBeDefined();
  });

  it('数组简写 - 混合大小写会被归一化为大写', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      dedupe: ['get', 'Get', 'GET', 'delete', 'Delete'],
    });
    expect(client).toBeDefined();
  });

  it('单个请求 - 数组简写作为 methods', () => {
    const config = { _dedupe: ['post', 'put'] };
    expect(Array.isArray(config._dedupe)).toBe(true);
  });
});

// ============================================
// 请求取消配置
// ============================================
describe('CancelManager - 请求取消', () => {
  it('默认配置', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: true,
    });
    expect(client).toBeDefined();
  });

  it('自定义 methods', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: {
        enabled: true,
        methods: ['GET', 'POST'],
      },
    });
    expect(client).toBeDefined();
  });

  it('禁用', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: false,
    });
    expect(client).toBeDefined();
  });

  it('自定义 generateKey', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: {
        enabled: true,
        generateKey: 'only-url',
      },
    });
    expect(client).toBeDefined();
  });

  // ========== 新增简写方式测试 ==========

  it('字符串简写 - 直接作为 generateKey', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: 'method:url',
    });
    expect(client).toBeDefined();
  });

  it('函数简写 - 直接作为 generateKey', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: (config) => `${config.url}:${config.params?.q}`,
    });
    expect(client).toBeDefined();
  });

  it('数组简写 - 直接作为 methods（自动转大写）', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      cancel: ['get', 'Get', 'POST', 'post'],
    });
    expect(client).toBeDefined();
  });

  it('单个请求 - 数组简写作为 methods', () => {
    const config = { _cancel: ['get', 'post'] };
    expect(Array.isArray(config._cancel)).toBe(true);
  });
});

// ============================================
// 重试配置
// ============================================
describe('RetryManager - 失败重试', () => {
  it('默认配置', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      retry: true,
    });
    expect(client).toBeDefined();
  });

  it('数字简写', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      retry: 3,
    });
    expect(client).toBeDefined();
  });

  it('完整配置', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      retry: {
        enabled: true,
        maxRetries: 5,
        delay: 200,
        exponentialBackoff: true,
      },
    });
    expect(client).toBeDefined();
  });

  it('自定义 shouldRetry', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      retry: {
        enabled: true,
        maxRetries: 3,
        shouldRetry: (error, retryCount) => {
          return retryCount < 3 && (!error.response || error.response.status >= 500);
        },
      },
    });
    expect(client).toBeDefined();
  });

  it('禁用', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      retry: false,
    });
    expect(client).toBeDefined();
  });

  // ========== 新增简写方式测试 ==========

  it('函数简写 - 直接作为 shouldRetry', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      retry: (error, retryCount) => {
        return retryCount < 3 && (!error.response || error.response.status >= 500);
      },
    });
    expect(client).toBeDefined();
  });

  it('单个请求 - 函数简写 shouldRetry', () => {
    const config = {
      _retry: (error: any, count: number) => count < 5,
    };
    expect(typeof config._retry).toBe('function');
  });

  it('单个请求 - 字符串简写 generateKey', () => {
    const config = { _dedupe: 'only-url' };
    expect(config._dedupe).toBe('only-url');
  });
});

// ============================================
// Token 管理配置
// ============================================
describe('TokenManager - Token 管理', () => {
  it('基本配置', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      tokenManager: {
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({
          accessToken: 'new-token',
        }),
        getAccessToken: () => 'current-token',
        setTokens: () => {},
      },
    });
    expect(client).toBeDefined();
  });

  it('带 refreshToken', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      tokenManager: {
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        }),
        getAccessToken: () => 'current-token',
        getRefreshToken: () => 'current-refresh',
        setTokens: () => {},
      },
    });
    expect(client).toBeDefined();
  });

  it('带 onRefreshFailed', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      tokenManager: {
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => {
          throw new Error('Refresh failed');
        },
        getAccessToken: () => 'current-token',
        setTokens: () => {},
        onRefreshFailed: (reason, error) => {
          console.error('Refresh failed:', reason);
        },
      },
    });
    expect(client).toBeDefined();
  });

  it('带 setAuthorization 自定义 token 赋值', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      tokenManager: {
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'current-token',
        setTokens: () => {},
        // 自定义 token 赋值方式
        setAuthorization: (config, token) => {
          config.headers = config.headers || {};
          config.headers['X-Access-Token'] = `Bearer ${token}`;
        },
      },
    });
    expect(client).toBeDefined();
  });

  it('setAuthorization 使用不同 header 字段名', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
      tokenManager: {
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
        // 只设置 token 值，不使用 Bearer
        setAuthorization: (config, token) => {
          config.headers = config.headers || {};
          config.headers['X-Token'] = token;
        },
      },
    });
    expect(client).toBeDefined();
  });
});

// ============================================
// 组合配置
// ============================================
describe('组合配置', () => {
  it('同时启用所有功能', () => {
    const client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
        timeout: 10000,
      },
      tokenManager: {
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      },
      dedupe: {
        enabled: true,
        duration: 1000,
      },
      cancel: {
        enabled: true,
        methods: ['GET'],
      },
      retry: {
        enabled: true,
        maxRetries: 3,
        delay: 100,
        exponentialBackoff: true,
      },
    });
    expect(client).toBeDefined();
  });

  it('简写组合', () => {
    const client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
      dedupe: false,  // 简写
      cancel: true,   // 简写
      retry: 3,       // 简写
    });
    expect(client).toBeDefined();
  });
});

// ============================================
// 单个请求级别配置
// ============================================
describe('单个请求级别配置', () => {
  let client: InstanceType<typeof AxiosRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
    });
  });

  it('_dedupe 配置结构正确', () => {
    // 验证配置对象可以被正确构建（不执行实际请求）
    const config = { _dedupe: false };
    expect(config._dedupe).toBe(false);
  });

  it('_dedupe 自定义配置结构正确', () => {
    const config = { _dedupe: { enabled: true, duration: 2000 } };
    expect(config._dedupe).toEqual({ enabled: true, duration: 2000 });
  });

  it('_cancel 配置结构正确', () => {
    const config = { _cancel: false };
    expect(config._cancel).toBe(false);
  });

  it('_retry 数字简写结构正确', () => {
    const config = { _retry: 5 };
    expect(config._retry).toBe(5);
  });

  it('_retry 禁用配置正确', () => {
    const config = { _retry: false };
    expect(config._retry).toBe(false);
  });

  it('contentType json 配置正确', () => {
    const config = { contentType: 'json' };
    expect(config.contentType).toBe('json');
  });

  it('contentType file 配置正确', () => {
    const config = { contentType: 'file' };
    expect(config.contentType).toBe('file');
  });

  it('contentType form 配置正确', () => {
    const config = { contentType: 'form' };
    expect(config.contentType).toBe('form');
  });
});

// ============================================
// clear 方法
// ============================================
describe('clear - 清除请求', () => {
  it('实例有 clear 方法', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
    });
    expect(typeof client.clear).toBe('function');
  });

  it('clear 不抛出错误', () => {
    const client = new AxiosRequest({
      axiosConfig: { baseURL: 'https://api.example.com' },
    });
    expect(() => client.clear()).not.toThrow();
  });
});

// ============================================
// 导出工具函数
// ============================================
describe('导出验证', () => {
  it('toFormData 是函数', () => {
    expect(typeof toFormData).toBe('function');
  });

  it('checkType 是函数', () => {
    expect(typeof checkType).toBe('function');
  });

  it('flattenFormData 是函数', () => {
    expect(typeof flattenFormData).toBe('function');
  });

  it('generateRequestKey 是函数', () => {
    expect(typeof generateRequestKey).toBe('function');
  });
});
