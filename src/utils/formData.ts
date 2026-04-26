/**
 * FormData 值类型 - 递归类型定义
 */
export type FormDataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | File
  | Blob
  | FormDataValue[]
  | { [key: string]: FormDataValue };

/**
 * 将数据递归展平为键值对数组（用于调试）
 */
export type FlattenedEntry = [key: string, value: string | File | Blob];

/**
 * 类型检测结果
 */
export interface TypeCheckResult {
  /** 类型名称 */
  type: string;
  /** 是否为 Blob/File */
  isBlob: boolean;
  /** 是否为普通对象 */
  isPlainObject: boolean;
  /** 是否为数组 */
  isArray: boolean;
  /** 是否为基本类型 */
  isPrimitive: boolean;
}

/**
 * 检测值类型
 * @param value - 要检测的值
 * @returns 类型检测结果
 */
export function checkType(value: any): TypeCheckResult {
  // null
  if (value === null) {
    return { type: 'null', isBlob: false, isPlainObject: false, isArray: false, isPrimitive: true };
  }

  // undefined
  if (value === undefined) {
    return { type: 'undefined', isBlob: false, isPlainObject: false, isArray: false, isPrimitive: true };
  }

  // Date（必须在 Blob 之前判断，因为 Date instanceof Object）
  if (value instanceof Date) {
    return { type: 'Date', isBlob: false, isPlainObject: false, isArray: false, isPrimitive: true };
  }

  // Blob/File
  if (value instanceof Blob) {
    const type = value instanceof File ? 'File' : 'Blob';
    return { type, isBlob: true, isPlainObject: false, isArray: false, isPrimitive: false };
  }

  // 数组
  if (Array.isArray(value)) {
    return { type: 'Array', isBlob: false, isPlainObject: false, isArray: true, isPrimitive: false };
  }

  // 基本类型
  const primitiveType = typeof value;
  if (primitiveType !== 'object') {
    return { type: primitiveType, isBlob: false, isPlainObject: false, isArray: false, isPrimitive: true };
  }

  // 普通对象
  return { type: 'Object', isBlob: false, isPlainObject: true, isArray: false, isPrimitive: false };
}

/**
 * 格式化基本类型值为字符串
 * @param value - 基本类型值
 * @returns 格式化后的字符串
 */
function formatPrimitiveValue(value: string | number | boolean | null | undefined | Date): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * 将数据转换为 FormData
 * 支持：File、File[]、Blob、普通对象、数组、Date、基本类型
 *
 * @param data - 要转换的数据
 * @param formData - 可选，传入已有的 FormData 实例
 * @param parentKey - 父级 key（用于递归）
 * @returns FormData 实例
 *
 * @example
 * // 单个文件
 * toFormData({ avatar: file })
 *
 * // 文件数组
 * toFormData({ attachments: [file1, file2] })
 *
 * // 嵌套对象
 * toFormData({ user: { name: '张三', age: 25 } })
 * // 结果: user.name=张三&user.age=25
 *
 * // 数组
 * toFormData({ tags: ['a', 'b', 'c'] })
 * // 结果: tags[0]=a&tags[1]=b&tags[2]=c
 *
 * // Date 类型
 * toFormData({ createdAt: new Date('2024-01-01') })
 * // 结果: createdAt: 2024-01-01T00:00:00.000Z
 *
 * // 混合
 * toFormData({
 *   name: '张三',
 *   files: [file1, file2],
 *   profile: { bio: '简介' }
 * })
 */
export function toFormData(data: any, formData?: FormData, parentKey?: string): FormData {
  const fd = formData || new FormData();
  const typeInfo = checkType(data);

  // null/undefined
  if (typeInfo.type === 'null' || typeInfo.type === 'undefined') {
    if (parentKey !== undefined) {
      fd.append(parentKey, '');
    }
    return fd;
  }

  // Blob/File 对象（直接追加）
  if (typeInfo.isBlob) {
    fd.append(parentKey!, data);
    return fd;
  }

  // 数组
  if (typeInfo.isArray) {
    data.forEach((value: any, index: number) => {
      const key = parentKey ? `${parentKey}[${index}]` : String(index);
      toFormData(value, fd, key);
    });
    return fd;
  }

  // 普通对象
  if (typeInfo.isPlainObject) {
    Object.entries(data).forEach(([key, value]) => {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      toFormData(value, fd, newKey);
    });
    return fd;
  }

  // 基本类型：string, number, boolean, Date
  if (typeInfo.isPrimitive && parentKey !== undefined) {
    fd.append(parentKey, formatPrimitiveValue(data));
  }

  return fd;
}

/**
 * 将 FormData 展平为键值对数组（用于调试或日志）
 * @param formData - FormData 实例
 * @returns 键值对数组
 */
export function flattenFormData(formData: FormData): FlattenedEntry[] {
  return [...formData.entries()] as FlattenedEntry[];
}
