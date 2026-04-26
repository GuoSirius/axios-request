import { AxiosRequestConfig } from 'axios';

/**
 * 生成请求的唯一key，用于防重复提交和请求取消
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
 * @param obj 任意对象
 * @returns 排序后的对象
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
 * 默认的生成请求key函数（可以被自定义替换）
 */
export const defaultGenerateRequestKey = generateRequestKey;
