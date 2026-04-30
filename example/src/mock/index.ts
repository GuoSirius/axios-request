import { MockMethod } from 'vite-plugin-mock';

export default [
  {
    url: '/api/data',
    method: 'get',
    response: () => {
      return {
        code: 200,
        data: {
          id: 1,
          name: 'Test Data',
          value: Math.random() * 100,
        },
      };
    },
  },
  {
    url: '/api/data',
    method: 'post',
    response: () => {
      return {
        code: 200,
        data: {
          success: true,
          message: 'Data created successfully',
        },
      };
    },
  },
  {
    url: '/api/refresh-token',
    method: 'post',
    response: () => {
      return {
        code: 200,
        data: {
          accessToken: 'new-access-token-' + Date.now().toString(36),
          refreshToken: 'new-refresh-token-' + Date.now().toString(36),
        },
      };
    },
  },
  {
    url: '/api/public/data',
    method: 'get',
    response: () => {
      return {
        code: 200,
        data: {
          public: true,
          message: 'This is public data',
        },
      };
    },
  },
] as MockMethod[];
