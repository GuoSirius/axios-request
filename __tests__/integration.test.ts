import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AxiosRequest } from '../src';
import type { AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';

// ============================================
// Mock axios factory
// ============================================
function createMockAxios() {
  const mockRequest = vi.fn<[AxiosRequestConfig], Promise<AxiosResponse>>();
  const mockCreate = vi.fn(() => ({
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn((onFulfilled, onRejected) => ({ onFulfilled, onRejected })) },
    },
    request: mockRequest,
    get: mockRequest,
    post: mockRequest,
    put: mockRequest,
    patch: mockRequest,
    delete: mockRequest,
    head: mockRequest,
    options: mockRequest,
  }));

  return { mockRequest, mockCreate };
}

// ============================================
// Integration Tests
// ============================================
describe('AxiosRequest - 集成测试', () => {

  // ============================================
  // Content-Type 处理测试
  // ============================================
  describe('Content-Type 处理', () => {
    let mockRequest: any;
    let mockCreate: any;

    beforeEach(() => {
      const mocks = createMockAxios();
      mockRequest = mocks.mockRequest;
      mockCreate = mocks.mockCreate;

      vi.doMock('axios', () => ({
        default: { create: mockCreate },
      }));
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('json Content-Type 设置正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'post',
        contentType: 'json',
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.headers?.['Content-Type']).toBe('application/json;charset=UTF-8');
    });

    it('form Content-Type 设置正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'post',
        contentType: 'form',
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('file Content-Type 不设置', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'post',
        contentType: 'file',
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.headers?.['Content-Type']).toBeUndefined();
    });

    it('自定义 Content-Type 设置正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'post',
        contentType: 'application/xml',
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.headers?.['Content-Type']).toBe('application/xml');
    });

    it('无 contentType 不设置', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'post',
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.headers?.['Content-Type']).toBeUndefined();
    });
  });

  // ============================================
  // HTTP 方法测试
  // ============================================
  describe('HTTP 方法测试', () => {
    let mockRequest: any;

    beforeEach(() => {
      const mocks = createMockAxios();
      mockRequest = mocks.mockRequest;

      vi.doMock('axios', () => ({
        default: { create: mocks.mockCreate },
      }));
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('get 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: { users: [] } });

      await client.get('/users');

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('GET');
      expect(calledConfig.url).toBe('/users');
    });

    it('post 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: { id: 1 } });

      await client.post('/users', { name: '张三' });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('POST');
      expect(calledConfig.url).toBe('/users');
      expect(calledConfig.data).toEqual({ name: '张三' });
    });

    it('put 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.put('/users/1', { name: '李四' });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('PUT');
      expect(calledConfig.url).toBe('/users/1');
    });

    it('patch 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.patch('/users/1', { name: '王五' });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('PATCH');
    });

    it('delete 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.delete('/users/1');

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('DELETE');
    });

    it('head 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.head('/users');

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('HEAD');
    });

    it('options 方法正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.options('/users');

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('OPTIONS');
    });
  });

  // ============================================
  // Method 大小写处理测试
  // ============================================
  describe('Method 大小写处理', () => {
    let mockRequest: any;

    beforeEach(() => {
      const mocks = createMockAxios();
      mockRequest = mocks.mockRequest;

      vi.doMock('axios', () => ({
        default: { create: mocks.mockCreate },
      }));
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('小写 method 自动转大写', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'get', // 小写
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('GET');
    });

    it('大写 method 保持不变', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'POST', // 大写
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('POST');
    });

    it('混合大小写 method 转大写', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ baseURL: '/api' });
      mockRequest.mockResolvedValueOnce({ data: {} });

      await client.request({
        url: '/test',
        method: 'PuT', // 混合大小写
      });

      const calledConfig = mockRequest.mock.calls[0][0];
      expect(calledConfig.method).toBe('PUT');
    });
  });

  // ============================================
  // 实例配置测试
  // ============================================
  describe('实例配置测试', () => {
    it('getInstanceConfig 返回配置副本', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({
        baseURL: '/api',
        timeout: 5000,
        headers: { 'X-Custom': 'value' },
      });

      const config = client.getInstanceConfig();
      expect(config.baseURL).toBe('/api');
      expect(config.timeout).toBe(5000);
      expect(config.headers).toEqual({ 'X-Custom': 'value' });

      // 修改副本不应影响原配置
      config.timeout = 10000;
      const config2 = client.getInstanceConfig();
      expect(config2.timeout).toBe(5000);
    });

    it('setTokenManager 更新 token 管理器', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest();

      // 设置 token 管理器
      client.setTokenManager({
        isTokenExpired: (error) => error.response?.status === 401,
        refreshToken: async () => ({ accessToken: 'new-token' }),
        getAccessToken: () => 'token',
        setTokens: () => {},
      });

      // 不应抛出错误
      expect(() => client.setTokenManager({
        isTokenExpired: () => false,
        refreshToken: async () => ({ accessToken: 'another-token' }),
        getAccessToken: () => 'token2',
        setTokens: () => {},
      })).not.toThrow();
    });

    it('destroy 清理资源', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({
        dedupe: true,
        cancel: true,
      });

      // 清理不应抛出错误
      expect(() => client.destroy()).not.toThrow();
    });

    it('clear 清理待处理请求', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({
        dedupe: true,
        cancel: true,
      });

      // 清理不应抛出错误
      expect(() => client.clear()).not.toThrow();
    });
  });

  // ============================================
  // 导出验证测试
  // ============================================
  describe('导出验证', () => {
    it('所有管理器可导出', async () => {
      const {
        AxiosRequest,
        TokenManager,
        DedupeManager,
        CancelManager,
        RetryManager,
        generateRequestKey,
        createGenerateKey,
        normalizeGenerateKey,
        toFormData,
        checkType,
        flattenFormData,
        deepMerge,
        shallowMerge,
        mergeConfig,
        createConfigMerger,
      } = await import('../src');

      expect(AxiosRequest).toBeDefined();
      expect(typeof AxiosRequest).toBe('function');
      expect(TokenManager).toBeDefined();
      expect(DedupeManager).toBeDefined();
      expect(CancelManager).toBeDefined();
      expect(RetryManager).toBeDefined();
      expect(generateRequestKey).toBeDefined();
      expect(createGenerateKey).toBeDefined();
      expect(normalizeGenerateKey).toBeDefined();
      expect(toFormData).toBeDefined();
      expect(checkType).toBeDefined();
      expect(flattenFormData).toBeDefined();
      expect(deepMerge).toBeDefined();
      expect(shallowMerge).toBeDefined();
      expect(mergeConfig).toBeDefined();
      expect(createConfigMerger).toBeDefined();
    });

    it('默认导出是 AxiosRequest', async () => {
      const axiosRequest = await import('../src');
      const defaultExport = axiosRequest.default;
      expect(defaultExport).toBe(axiosRequest.AxiosRequest);
    });
  });

  // ============================================
  // ManagerRegistry 行为测试
  // ============================================
  describe('ManagerRegistry 行为测试', () => {
    it('实例无配置时不创建管理器', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest();

      // 无配置时应能正常工作
      expect(() => client.clear()).not.toThrow();
      expect(() => client.destroy()).not.toThrow();
    });

    it('dedupe: true 启用防重复提交', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ dedupe: true });
      expect(client).toBeDefined();
    });

    it('cancel: true 启用请求取消', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ cancel: true });
      expect(client).toBeDefined();
    });

    it('retry: true 启用重试', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({ retry: true });
      expect(client).toBeDefined();
    });

    it('组合配置正确', async () => {
      vi.resetModules();
      const { AxiosRequest } = await import('../src');

      const client = new AxiosRequest({
        dedupe: { timeWindow: 500 },
        cancel: { methods: ['GET', 'POST'] },
        retry: { maxRetries: 5 },
      });
      expect(client).toBeDefined();
    });
  });
});
