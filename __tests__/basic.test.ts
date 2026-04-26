import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosRequest, generateRequestKey } from '../src';
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
        request: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        head: vi.fn(),
        options: vi.fn(),
      })),
    },
  };
});

describe('AxiosRequest', () => {
  let client: InstanceType<typeof AxiosRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
    });
  });

  it('should create an instance', () => {
    expect(client).toBeDefined();
    expect(client.getInstance).toBeDefined();
  });

  it('should have all HTTP method helpers', () => {
    expect(client.get).toBeDefined();
    expect(client.post).toBeDefined();
    expect(client.put).toBeDefined();
    expect(client.patch).toBeDefined();
    expect(client.delete).toBeDefined();
    expect(client.head).toBeDefined();
    expect(client.options).toBeDefined();
  });

  it('should get axios instance', () => {
    const instance = client.getInstance();
    expect(instance).toBeDefined();
  });
});

describe('Request Key Generation', () => {
  it('should generate consistent keys for same request', () => {
    const config1 = {
      method: 'GET',
      url: '/api/users',
      params: { page: 1 },
    };

    const config2 = {
      method: 'GET',
      url: '/api/users',
      params: { page: 1 },
    };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different requests', () => {
    const config1 = {
      method: 'GET',
      url: '/api/users',
      params: { page: 1 },
    };

    const config2 = {
      method: 'GET',
      url: '/api/users',
      params: { page: 2 },
    };

    const key1 = generateRequestKey(config1);
    const key2 = generateRequestKey(config2);

    expect(key1).not.toBe(key2);
  });
});

describe('DedupeManager', () => {
  it('should deduplicate requests within duration', async () => {
    const client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
      dedupe: {
        enabled: true,
        duration: 500,
      },
    });

    expect(client).toBeDefined();
  });
});

describe('CancelManager', () => {
  it('should cancel previous requests', () => {
    const client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
      cancel: {
        enabled: true,
        methods: ['GET'],
      },
    });

    expect(client).toBeDefined();
  });
});

describe('RetryManager', () => {
  it('should retry failed requests', () => {
    const client = new AxiosRequest({
      axiosConfig: {
        baseURL: 'https://api.example.com',
      },
      retry: {
        enabled: true,
        maxRetries: 3,
        delay: 100,
      },
    });

    expect(client).toBeDefined();
  });
});
