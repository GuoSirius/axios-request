import type { AxiosRequestConfig } from 'axios';
import type {
  TokenManagerConfig,
  TokenRefreshFailureReason,
  TokenContext,
} from '../types';
import { BaseManager } from './base/BaseManager';

/**
 * Token 管理器 - 处理 token 过期自动刷新和请求队列
 *
 * 功能：
 * 1. 在请求前检查 token 是否有效，无效则刷新
 * 2. 在响应中检查业务 code 是否表示 token 过期
 * 3. 在错误中检查是否 token 过期（如 401）
 * 4. 支持白名单 URL（不需要 token 的请求）
 * 5. 自动管理刷新队列，防止重复刷新
 *
 * 设计原则：
 * - 实例级状态：isRefreshing、requestQueue（跨请求共享）
 * - 上下文状态：通过参数传递，不存储在 Map 中
 *
 * @example
 * ```typescript
 * const tokenManager = new TokenManager({
 *   isTokenExpired: (error) => error.response?.status === 401,
 *   isTokenExpiredFromResponse: (response) => response.data.code === 401001,
 *   refreshToken: async (error) => {
 *     const refreshToken = localStorage.getItem('refresh_token');
 *     const result = await api.refreshToken(refreshToken);
 *     return { accessToken: result.accessToken, refreshToken: result.refreshToken };
 *   },
 *   getAccessToken: () => localStorage.getItem('access_token'),
 *   getRefreshToken: () => localStorage.getItem('refresh_token'),
 *   setTokens: async (result) => {
 *     localStorage.setItem('access_token', result.accessToken);
 *     if (result.refreshToken) {
 *       localStorage.setItem('refresh_token', result.refreshToken);
 *     }
 *   },
 *   setAuthorization: (config, token) => {
 *     config.headers.Authorization = `Bearer ${token}`;
 *   },
 *   onRefreshFailed: (reason, error) => {
 *     console.error('Token refresh failed:', reason, error);
 *     window.location.href = '/login';
 *   },
 *   whitelistUrls: ['/api/public', /^\/api\/public\/./],
 * });
 * ```
 */
export class TokenManager extends BaseManager<TokenManagerConfig, TokenContext> {
  /** 管理器名称 */
  protected readonly managerName: string = 'TokenManager';

  /** 是否正在刷新 token */
  private isRefreshing: boolean = false;

  /**
   * 规范化配置（静态方法，供外部调用）
   * @param config - 用户提供的配置（可能是简写）
   * @returns { enabled: boolean, config?: Partial<TokenManagerConfig> }
   */
  static normalize(config?: Partial<TokenManagerConfig> | boolean | null): { enabled: boolean; config?: Partial<TokenManagerConfig> } {
    if (config === undefined || config === null) {
      return { enabled: false }; // Token 默认关闭
    }
    if (config === false) {
      return { enabled: false };
    }
    if (config === true) {
      return { enabled: false, config: undefined }; // true 语义不明确，视为未配置
    }
    return { enabled: true, config };
  }

  /** 请求队列（等待 token 刷新的请求） */
  private requestQueue: Array<{
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  /**
   * 获取默认配置
   * @returns 默认配置
   */
  protected getDefaultConfig(): TokenManagerConfig {
    return {
      isTokenExpired: () => false,
      getAccessToken: () => null,
      setTokens: () => {},
      refreshToken: async () => ({ accessToken: '' }),
      whitelistUrls: [],
    };
  }

  /**
   * 创建请求上下文
   * @param override - 请求级别的配置覆盖（可选，优先级高于全局）
   * @returns 请求上下文
   *
   * @example
   * ```typescript
   * // 使用全局配置
   * const context = tokenManager.createContext();
   *
   * // 使用请求级别的 token 获取函数
   * const context = tokenManager.createContext({
   *   getAccessToken: () => sessionStorage.getItem('token'),
   *   whitelistUrls: ['/api/public'],
   * });
   * ```
   */
  createContext(override?: Partial<TokenManagerConfig> | null): TokenContext {
    const config = this.mergeConfig(override || {});
    // 合并白名单 URL
    const mergedWhitelistUrls = [
      ...(this.defaultConfig.whitelistUrls || []),
      ...(config.whitelistUrls || []),
    ];

    return {
      getToken: config.getAccessToken || null,
      whitelistUrls: mergedWhitelistUrls,
    };
  }

  /**
   * 获取当前 token（优先使用上下文的 token 获取函数）
   * @param context - 请求上下文
   * @returns token 字符串或 null
   */
  getToken(context?: TokenContext): string | null {
    const getter = context?.getToken || this.defaultConfig.getAccessToken;
    return getter?.() || null;
  }

  /**
   * 检查 URL 是否在白名单中
   * @param url - 要检查的 URL
   * @param whitelistUrls - 白名单 URL 列表
   * @returns 是否在白名单中
   *
   * @example
   * ```typescript
   * // 字符串匹配（包含关系）
   * isUrlWhitelisted('/api/public/data', ['/api/public']); // => true
   *
   * // 正则匹配
   * isUrlWhitelisted('/api/public/data', [/^\/api\/public\/./]); // => true
   * ```
   */
  isUrlWhitelisted(url: string, whitelistUrls: (string | RegExp)[]): boolean {
    if (!whitelistUrls || whitelistUrls.length === 0) {
      return false;
    }

    return whitelistUrls.some((item) => {
      if (typeof item === 'string') {
        // 字符串匹配（包含关系）
        return url.includes(item);
      } else if (item instanceof RegExp) {
        // 正则匹配
        return item.test(url);
      }
      return false;
    });
  }

  /**
   * 检查请求是否不需要 token
   * @param config - Axios 请求配置
   * @param context - 请求上下文
   * @returns 是否不需要 token
   */
  shouldSkipToken(config: AxiosRequestConfig, context?: TokenContext): boolean {
    const url = config.url || '';
    const whitelistUrls = context?.whitelistUrls || this.defaultConfig.whitelistUrls || [];
    return this.isUrlWhitelisted(url, whitelistUrls);
  }

  /**
   * 检查正常响应是否表示 token 失效
   * @param response - Axios 响应对象
   * @returns 是否 token 失效
   */
  isTokenExpiredFromResponse(response: any): boolean {
    return this.defaultConfig.isTokenExpiredFromResponse?.(response) ?? false;
  }

  /**
   * 判断是否是 token 过期错误
   * @param error - Axios 错误对象
   * @returns 是否 token 过期
   */
  isTokenExpired(error: any): boolean {
    return this.defaultConfig.isTokenExpired(error);
  }

  /**
   * 设置 Authorization header
   * @param config - Axios 请求配置
   * @param token - token 字符串
   *
   * @example
   * ```typescript
   * // 默认行为：config.headers.Authorization = `Bearer ${token}`
   *
   * // 自定义：在创建 TokenManager 时传入 setAuthorization 函数
   * const tokenManager = new TokenManager({
   *   // ...
   *   setAuthorization: (config, token) => {
   *     config.headers['X-Token'] = token;
   *   },
   * });
   * ```
   */
  setAuthorization(config: AxiosRequestConfig, token: string): void {
    if (this.defaultConfig.setAuthorization) {
      this.defaultConfig.setAuthorization(config, token);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  /**
   * 处理 token 过期的请求
   * @param context - 请求上下文
   * @param error - Axios 错误对象
   * @param requestConfig - 原始请求配置
   * @param retryRequest - 重试请求的函数
   * @returns Promise，解析为重试结果
   */
  async handleExpiredToken(
    context: TokenContext,
    error: any,
    requestConfig: AxiosRequestConfig,
    retryRequest: (config: AxiosRequestConfig) => Promise<any>
  ): Promise<any> {
    // 如果正在刷新，将请求加入队列
    if (this.isRefreshing) {
      return this.enqueueRequest(requestConfig);
    }

    // 标记为正在刷新
    this.isRefreshing = true;

    try {
      // 刷新 token
      const refreshResult = await this.defaultConfig.refreshToken(error);

      // 保存新的 token
      await this.defaultConfig.setTokens(refreshResult);

      // 处理队列中的请求（使用新 token）
      this.processQueue(null);

      // 重试当前请求
      const newToken = this.getToken(context);
      if (newToken) {
        this.setAuthorization(requestConfig, newToken);
      }
      return await retryRequest(requestConfig);
    } catch (refreshError) {
      // 刷新失败
      const failureReason = this.determineFailureReason(refreshError);
      this.defaultConfig.onRefreshFailed?.(failureReason, refreshError);
      this.processQueue(refreshError);
      throw refreshError;
    } finally {
      // 重置刷新状态
      this.isRefreshing = false;
    }
  }

  /**
   * 将请求加入队列
   * @param _config - 请求配置（保留用于未来扩展）
   * @returns Promise，等待 token 刷新完成后解析
   */
  private enqueueRequest(_config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject });
    });
  }

  /**
   * 处理队列中的请求
   * @param error - 如果刷新失败，传入错误对象；否则传入 null
   * @param _newToken - 新的 token（可选，保留用于未来扩展）
   */
  private processQueue(error: any, _newToken?: string): void {
    this.requestQueue.forEach((item) => {
      if (error) {
        // 刷新失败，拒绝所有队列中的请求
        item.reject(error);
      } else {
        // 刷新成功，解析所有队列中的请求
        // 注意：实际的 token 更新需要在重试请求之前完成
        item.resolve(undefined);
      }
    });

    // 清空队列
    this.requestQueue = [];
  }

  /**
   * 判断刷新失败的原因
   * @param error - 错误对象
   * @returns 失败原因
   */
  private determineFailureReason(error: any): TokenRefreshFailureReason {
    if (!error?.response) return 'network_error';
    const status = error.response.status;
    if (status === 401) return 'invalid_refresh_token';
    if (status === 403) return 'forbidden';
    if (status === 408 || error?.code === 'ECONNABORTED') return 'refresh_timeout';
    return 'unknown';
  }

  /**
   * 销毁管理器，清理所有资源
   * 应该在实例销毁时调用
   */
  destroy(): void {
    // 清空队列，拒绝所有待处理请求
    this.requestQueue.forEach((item) => {
      item.reject(new Error('TokenManager destroyed'));
    });
    this.requestQueue = [];

    // 重置刷新状态
    this.isRefreshing = false;
  }
}
