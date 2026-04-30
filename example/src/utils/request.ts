import { AxiosRequest } from '../../../src';
import Mock from 'mockjs';

// ============================================================
// 创建基础 AxiosRequest 实例
// ============================================================
export const api = new AxiosRequest({
  baseURL: '/api',
  timeout: 10000,

  // Token 管理配置
  token: {
    // 判断 token 是否过期（拦截点 C：401 异常）
    isTokenExpired: (error: any) => {
      if (error?.response?.status === 401) return true;
      if (error?.response?.data?.code === 401) return true;
      return false;
    },

    // 判断响应中的业务 code 是否表示 token 过期（拦截点 B：200 响应）
    isTokenExpiredFromResponse: (response: any) => {
      return response?.code === 401 || response?.expired === true;
    },

    // 刷新 token
    refreshToken: async (error: any) => {
      console.log('刷新 Token...', error);
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (error?.response?.data?.refreshExpired) {
        throw new Error('refresh_token 已过期，请重新登录');
      }

      return {
        accessToken: 'new-access-token-' + Date.now(),
        refreshToken: 'new-refresh-token-' + Date.now(),
      };
    },

    // 获取当前 token
    getAccessToken: () => {
      return localStorage.getItem('access_token') || 'mock-access-token';
    },

    // 获取 refresh token
    getRefreshToken: () => {
      return localStorage.getItem('refresh_token') || 'mock-refresh-token';
    },

    // 保存新 token
    setTokens: (result: { accessToken: string; refreshToken?: string }) => {
      localStorage.setItem('access_token', result.accessToken);
      if (result.refreshToken) {
        localStorage.setItem('refresh_token', result.refreshToken);
      }
      console.log('Token 已更新:', result);
    },

    // 刷新失败回调
    onRefreshFailed: (reason: string, error: any) => {
      console.error('Token 刷新失败:', reason, error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    },

    // 自定义 token 赋值方式
    setAuthorization: (config: any, token: string) => {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
      config.headers['X-Access-Token'] = token;
    },
  },

  // 防重复提交（默认开启）
  dedupe: {
    enabled: true,
    timeWindow: 1000,
  },

  // 请求取消（默认开启，仅 GET）
  cancel: {
    enabled: true,
    methods: ['GET'],
  },

  // 失败重试（默认关闭）
  retry: false,
});

// ============================================================
// 创建带自定义 request key 的实例
// ============================================================
export const apiWithCustomKey = new AxiosRequest({
  baseURL: '/api',
  timeout: 10000,

  // 自定义请求 key 生成方式（包含更多参数）
  requestKey: {
    includeData: true,
    includeParams: true,
  },

  dedupe: true,
});

// ============================================================
// Mock 拦截器设置
// ============================================================
Mock.setup({
  timeout: 200,
});

// 公开接口（白名单）
Mock.mock(/\/api\/public\/news/, {
  code: 200,
  message: 'success',
  data: {
    news: [
      { id: 1, title: '公开新闻1', content: '这是公开内容1' },
      { id: 2, title: '公开新闻2', content: '这是公开内容2' },
    ],
  },
});

// 健康检查
Mock.mock(/\/api\/health/, {
  code: 200,
  message: 'success',
  data: {
    status: 'ok',
    timestamp: Date.now(),
  },
});

// 用户列表（会检测 token）
Mock.mock(/\/api\/users/, (options: any) => {
  if (options.headers?.Authorization?.includes('expired')) {
    return {
      code: 401,
      message: 'Token 已过期',
    };
  }

  return {
    code: 200,
    message: 'success',
    data: {
      users: [
        { id: 1, name: '张三', email: 'zhangsan@example.com' },
        { id: 2, name: '李四', email: 'lisi@example.com' },
      ],
    },
  };
});

// 业务 code 过期测试
Mock.mock(/\/api\/business-code-test/, {
  code: 401,
  expired: true,
  message: 'Token 已过期（业务 code）',
});

// 通用测试接口
Mock.mock(/\/api\/test/, {
  code: 200,
  message: 'success',
  data: {
    result: 'ok',
  },
});

// 防重复提交测试接口
Mock.mock(/\/api\/submit/, (options: any) => {
  console.log('收到提交请求:', options.body);
  return {
    code: 200,
    message: 'success',
    data: {
      id: Date.now(),
      submitted: true,
    },
  };
});

// 搜索接口（可取消）
Mock.mock(/\/api\/search/, {
  code: 200,
  message: 'success',
  data: {
    results: [
      { id: 1, title: '搜索结果1' },
      { id: 2, title: '搜索结果2' },
    ],
  },
});

// 失败重试测试接口
Mock.mock(/\/api\/flaky/, (options: any) => {
  const shouldFail = (options.headers?.['X-Retry-Count'] || 0) < 2;
  console.log('Flaky API - 尝试次数:', (options.headers?.['X-Retry-Count'] || 0) + 1, '是否失败:', shouldFail);

  if (shouldFail) {
    return {
      code: 500,
      message: '服务器错误，请重试',
    };
  }

  return {
    code: 200,
    message: 'success',
    data: {
      result: '成功!',
    },
  };
});

// FormData 测试接口
Mock.mock(/\/api\/upload/, (options: any) => {
  console.log('收到文件上传请求');
  return {
    code: 200,
    message: 'success',
    data: {
      filename: 'uploaded-file',
      size: 1024,
    },
  };
});

// ============================================================
// 所有 HTTP 方法测试接口
// ============================================================
Mock.mock(/\/api\/posts/, {
  code: 200,
  message: 'success',
  data: [
    { id: 1, title: '文章1' },
    { id: 2, title: '文章2' },
  ],
});

Mock.mock(/\/api\/posts\/1/, {
  code: 200,
  message: 'success',
  data: { id: 1, title: '文章1', content: '这是文章内容' },
});

// ============================================================
// 添加请求日志拦截器
// ============================================================
api.getInstance().interceptors.request.use(
  (config: any) => {
    console.log('[Request]', config.method?.toUpperCase(), config.url, config);
    return config;
  },
  (error: any) => {
    console.error('[Request Error]', error);
    return Promise.reject(error);
  }
);

api.getInstance().interceptors.response.use(
  (response: any) => {
    console.log('[Response]', response.config.url, response.data);
    return response;
  },
  (error: any) => {
    console.error('[Response Error]', error.config?.url, error.response?.data);
    return Promise.reject(error);
  }
);

export default api;
