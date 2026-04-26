import { AxiosRequestConfig } from 'axios';

/**
 * 默认的请求 key 生成函数
 * @param config axios请求配置
 * @returns 请求的唯一key
 */
export function generateRequestKey(config: AxiosRequestConfig): string {
  const { method, url, params, data } = config;

  // 将params和data转换为字符串
  const paramsStr = params ? JSON.stringify(sortObjectKeys(params)) : '';
  const dataStr = data ? (typeof data === 'string' ? data : JSON.stringify(sortObjectKeys(data))) : '';

  // 组合成唯一key
  return `${method}:${url}:${paramsStr}:${dataStr}`;
}

/**
 * 对对象的key进行排序（保证相同对象生成相同的key）
 */
function sortObjectKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof File)) {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = sortObjectKeys(obj[key]);
        return result;
      }, {});
  }

  return obj;
}

/**
 * 根据路径从对象中获取值（支持嵌套路径，如 'data.user.id'）
 */
function getValueByPath(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  return value;
}

/**
 * 解析字段定义（支持字段别名）
 * - 'method' -> config.method
 * - 'url' -> config.url
 * - 'data' -> config.data
 * - 'params' -> config.params
 * - 'data.id' -> config.data?.id
 */
function resolveField(config: AxiosRequestConfig, field: string): string {
  // 处理特殊值
  if (field === 'method' || field === 'm') return (config.method || '').toUpperCase();
  if (field === 'url' || field === 'u') return config.url || '';

  // 处理 data、params 开头的路径
  if (field.startsWith('data.') || field === 'data') {
    const path = field === 'data' ? '' : field.substring(5);
    if (!path) {
      const data = config.data;
      return data ? (typeof data === 'string' ? data : JSON.stringify(data)) : '';
    }
    const value = getValueByPath(config.data, path);
    return value !== undefined ? String(value) : '';
  }

  if (field.startsWith('params.') || field === 'params') {
    const path = field === 'params' ? '' : field.substring(7);
    if (!path) {
      const params = config.params;
      return params ? JSON.stringify(sortObjectKeys(params)) : '';
    }
    const value = getValueByPath(config.params, path);
    return value !== undefined ? String(value) : '';
  }

  // 其他直接作为 config 的属性
  const value = config[field as keyof AxiosRequestConfig];
  return value !== undefined ? String(value) : '';
}

/**
 * 将字符串转换为 generateKey 函数
 * @param template 模板字符串，字段用冒号分隔
 *   例如：'method:url' -> `${method}:${url}`
 *   特殊值：'only-url' -> 只用 url
 * @returns generateKey 函数
 */
export function createGenerateKey(template: string): (config: AxiosRequestConfig) => string {
  // 特殊处理 only-url
  if (template === 'only-url') {
    return (config) => `${(config.method || '').toUpperCase()}:${config.url || ''}`;
  }

  const fields = template.split(':');

  return (config: AxiosRequestConfig) => {
    const parts = fields.map((field) => resolveField(config, field.trim()));
    return parts.join(':');
  };
}

/**
 * 将 generateKey 配置标准化为函数
 * @param generateKey 字符串或函数
 * @returns 标准化后的函数
 */
export function normalizeGenerateKey(generateKey?: string | ((config: AxiosRequestConfig) => string)): (config: AxiosRequestConfig) => string {
  if (!generateKey) {
    return generateRequestKey;
  }

  if (typeof generateKey === 'function') {
    return generateKey;
  }

  return createGenerateKey(generateKey);
}
