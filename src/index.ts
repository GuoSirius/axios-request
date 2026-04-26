// axios-request - 基于 axios 的增强请求库
// 导出核心类
export { AxiosRequest } from './core/AxiosRequest';

// 导出类型定义
export * from './types';

// 导出管理器（高级用法）
export { TokenManager } from './managers/TokenManager';
export { DedupeManager } from './managers/DedupeManager';
export { CancelManager } from './managers/CancelManager';
export { RetryManager } from './managers/RetryManager';

// 导出工具函数
export { generateRequestKey } from './utils/requestKey';

// 默认导出
import { AxiosRequest } from './core/AxiosRequest';
export default AxiosRequest;
