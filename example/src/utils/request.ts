import { AxiosRequest } from '../../../src';
import type { AxiosRequestInstanceConfig } from '../../../src/types';

const config: AxiosRequestInstanceConfig = {
  baseURL: '/api',
  timeout: 10000,
  // 实例级管理器配置
  token: {
    isTokenExpired: (error) => error.response?.status === 401,
    isTokenExpiredFromResponse: (response) => response?.code === 401001,
    refreshToken: async (error) => {
      const refreshToken = localStorage.getItem('refresh_token');
      const response = await fetch('/api/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await response.json();
      return {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
      };
    },
    getAccessToken: () => localStorage.getItem('access_token'),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    setTokens: async (result) => {
      localStorage.setItem('access_token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('refresh_token', result.refreshToken);
      }
    },
    setAuthorization: (config, token) => {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    },
    onRefreshFailed: (reason, error) => {
      console.error('Token refresh failed:', reason, error);
      window.location.href = '/login';
    },
    whitelistUrls: ['/api/public', /^\/api\/health\/.*/],
  },
  dedupe: {
    enabled: true,
    timeWindow: 1000,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
  cancel: {
    enabled: true,
    methods: ['GET'],
  },
  retry: {
    enabled: false,
    maxRetries: 3,
    retryDelay: 100,
    exponentialBackoff: false,
  },
};

const request = new AxiosRequest(config);

export default request;
export { config as requestConfig };
