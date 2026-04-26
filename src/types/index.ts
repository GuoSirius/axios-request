import { AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Token刷新函数的返回值
 */
export interface TokenRefreshResult {
  /** 新的access_token */
  accessToken: string;
  /** 新的refresh_token（可选） */
  refreshToken?: string;
}

/**
 * Token刷新失败的原因
 */
export type TokenRefreshFailureReason = 'unauthorized' | 'forbidden' | 'invalid_refresh_token' | 'refresh_timeout' | 'network_error' | 'unknown';

/**
 * Token管理器配置
 */
export interface TokenManagerConfig {
  /** 判断响应是否表示token失效 */
  isTokenExpired: (error: any) => boolean;
  /** 刷新token的函数，由使用者实现 */
  refreshToken: (error: any) => Promise<TokenRefreshResult>;
  /** 获取当前access_token的函数 */
  getAccessToken: () => string | null;
  /** 设置token的函数 */
  setTokens: (result: TokenRefreshResult) => void | Promise<void>;
  /** 获取当前refresh_token的函数（可选） */
  getRefreshToken?: () => string | null;
  /** token刷新失败的回调（可选） */
  onRefreshFailed?: (reason: TokenRefreshFailureReason, error: any) => void | Promise<void>;
}

/**
 * 防重复提交配置
 */
export interface DedupeConfig {
  /** 是否启用防重复提交，默认false */
  enabled: boolean;
  /** 防重复提交的时间窗口（毫秒），默认1000ms */
  duration?: number;
  /** 需要防重复提交的方法，默认['POST', 'PUT', 'PATCH', 'DELETE'] */
  methods?: string[];
  /** 自定义生成请求key的函数（可选） */
  generateKey?: (config: AxiosRequestConfig) => string;
}

/**
 * 请求取消配置（用于搜索等场景）
 */
export interface CancelConfig {
  /** 是否启用请求取消，默认false */
  enabled: boolean;
  /** 需要取消请求的方法，默认['GET'] */
  methods?: string[];
  /** 自定义生成请求key的函数（可选） */
  generateKey?: (config: AxiosRequestConfig) => string;
}

/**
 * 请求重试配置
 */
export interface RetryConfig {
  /** 是否启用重试，默认false */
  enabled: boolean;
  /** 最大重试次数，默认3 */
  maxRetries?: number;
  /** 重试延迟（毫秒），默认100 */
  delay?: number;
  /** 是否使用指数退避策略，默认false */
  exponentialBackoff?: boolean;
  /** 判断哪些错误需要重试，默认所有网络错误都重试 */
  shouldRetry?: (error: any, retryCount: number) => boolean;
}

/**
 * AxiosRequest配置（扩展axios配置）
 */
export interface AxiosRequestConfigExtended extends AxiosRequestConfig {
  /** Token管理配置 */
  _token?: TokenManagerConfig;
  /** 防重复提交配置 */
  _dedupe?: DedupeConfig | boolean;
  /** 请求取消配置 */
  _cancel?: CancelConfig | boolean;
  /** 请求重试配置 */
  _retry?: RetryConfig | boolean | number;
}

/**
 * AxiosRequest实例配置
 */
export interface AxiosRequestInstanceConfig {
  /** 基础axios配置 */
  axiosConfig?: AxiosRequestConfig;
  /** 全局Token管理配置 */
  tokenManager?: TokenManagerConfig;
  /** 全局防重复提交配置 */
  dedupe?: DedupeConfig;
  /** 全局请求取消配置 */
  cancel?: CancelConfig;
  /** 全局请求重试配置 */
  retry?: RetryConfig;
}

/**
 * 请求队列项
 */
export interface QueueItem {
  /** 原始请求配置 */
  config: AxiosRequestConfig;
  /** 解析函数 */
  resolve: (value: any) => void;
  /** 拒绝函数 */
  reject: (reason?: any) => void;
}

/**
 * 防重复提交的暂存项
 */
export interface DedupeItem {
  /** 定时器ID */
  timer: NodeJS.Timeout;
  /** Promise */
  promise: Promise<any>;
  /** 解析函数 */
  resolve: (value: any) => void;
  /** 拒绝函数 */
  reject: (reason?: any) => void;
}
