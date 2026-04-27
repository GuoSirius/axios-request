// axios-request - 基于 axios 的增强请求库
// 导出核心类
export { AxiosRequest } from './core/AxiosRequest';

// 导出类型定义
export * from './types';

// 导出管理器（高级用法）
export { TokenManager, normalizeTokenConfig } from './managers/TokenManager';
export { DedupeManager, normalizeDedupeConfig } from './managers/DedupeManager';
export { CancelManager, normalizeCancelConfig } from './managers/CancelManager';
export { RetryManager, normalizeRetryConfig } from './managers/RetryManager';

// 导出工具函数
export { generateRequestKey } from './utils/requestKey';
export { toFormData, checkType, flattenFormData } from './utils/formData';
export type { FormDataValue, FlattenedEntry, TypeCheckResult } from './utils/formData';

// 默认导出
import { AxiosRequest } from './core/AxiosRequest';
export default AxiosRequest;
