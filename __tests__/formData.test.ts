import { describe, it, expect } from 'vitest';
import { toFormData, checkType, flattenFormData } from '../src';

// ============================================
// checkType - 类型检测
// ============================================
describe('checkType - 类型检测', () => {
  it('null', () => {
    const result = checkType(null);
    expect(result.type).toBe('null');
    expect(result.isPrimitive).toBe(true);
    expect(result.isBlob).toBe(false);
  });

  it('undefined', () => {
    const result = checkType(undefined);
    expect(result.type).toBe('undefined');
    expect(result.isPrimitive).toBe(true);
  });

  it('string', () => {
    expect(checkType('hello').type).toBe('string');
    expect(checkType('').type).toBe('string');
  });

  it('number', () => {
    expect(checkType(42).type).toBe('number');
    expect(checkType(0).type).toBe('number');
    expect(checkType(-3.14).type).toBe('number');
  });

  it('boolean', () => {
    expect(checkType(true).type).toBe('boolean');
    expect(checkType(false).type).toBe('boolean');
  });

  it('Date', () => {
    const result = checkType(new Date());
    expect(result.type).toBe('Date');
    expect(result.isPrimitive).toBe(true);
  });

  it('File', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const result = checkType(file);
    expect(result.type).toBe('File');
    expect(result.isBlob).toBe(true);
  });

  it('Blob', () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const result = checkType(blob);
    expect(result.type).toBe('Blob');
    expect(result.isBlob).toBe(true);
  });

  it('Array', () => {
    const result = checkType([1, 2, 3]);
    expect(result.type).toBe('Array');
    expect(result.isArray).toBe(true);
  });

  it('plain Object', () => {
    const result = checkType({ a: 1 });
    expect(result.type).toBe('Object');
    expect(result.isPlainObject).toBe(true);
  });
});

// ============================================
// toFormData - 基础类型
// ============================================
describe('toFormData - 基础类型', () => {
  it('空对象', () => {
    const fd = toFormData({});
    expect(fd).toBeInstanceOf(FormData);
    expect([...fd.entries()]).toHaveLength(0);
  });

  it('null 和 undefined 参数', () => {
    const fd1 = toFormData(null);
    const fd2 = toFormData(undefined);
    expect(fd1).toBeInstanceOf(FormData);
    expect(fd2).toBeInstanceOf(FormData);
  });

  it('string 值', () => {
    const fd = toFormData({ name: '张三', message: 'hello' });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['name', '张三']);
    expect(entries).toContainEqual(['message', 'hello']);
  });

  it('number 值', () => {
    const fd = toFormData({ age: 25, price: 99.9 });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['age', '25']);
    expect(entries).toContainEqual(['price', '99.9']);
  });

  it('boolean 值', () => {
    const fd = toFormData({ active: true, deleted: false });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['active', 'true']);
    expect(entries).toContainEqual(['deleted', 'false']);
  });

  it('null 值', () => {
    const fd = toFormData({ name: null, value: 'test' });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['name', '']);
    expect(entries).toContainEqual(['value', 'test']);
  });

  it('undefined 值', () => {
    const fd = toFormData({ name: undefined, value: 'test' });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['name', '']);
    expect(entries).toContainEqual(['value', 'test']);
  });
});

// ============================================
// toFormData - Date 类型
// ============================================
describe('toFormData - Date 类型', () => {
  it('Date 对象', () => {
    const date = new Date('2024-01-01T12:00:00.000Z');
    const fd = toFormData({ createdAt: date });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['createdAt', '2024-01-01T12:00:00.000Z']);
  });

  it('Date 在嵌套对象中', () => {
    const date = new Date('2024-06-15T08:30:00.000Z');
    const fd = toFormData({ user: { birthDate: date } });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['user.birthDate', '2024-06-15T08:30:00.000Z']);
  });

  it('Date 数组', () => {
    const dates = [new Date('2024-01-01'), new Date('2024-02-01')];
    const fd = toFormData({ dates });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['dates[0]', '2024-01-01T00:00:00.000Z']);
    expect(entries).toContainEqual(['dates[1]', '2024-02-01T00:00:00.000Z']);
  });
});

// ============================================
// toFormData - 嵌套对象
// ============================================
describe('toFormData - 嵌套对象', () => {
  it('一级嵌套', () => {
    const fd = toFormData({
      user: {
        name: '张三',
        age: 25,
      },
    });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['user.name', '张三']);
    expect(entries).toContainEqual(['user.age', '25']);
  });

  it('多级嵌套', () => {
    const fd = toFormData({
      user: {
        profile: {
          name: '李四',
          address: {
            city: '北京',
          },
        },
      },
    });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['user.profile.name', '李四']);
    expect(entries).toContainEqual(['user.profile.address.city', '北京']);
  });

  it('嵌套数组', () => {
    const fd = toFormData({
      company: {
        employees: [
          { name: '张三', age: 25 },
          { name: '李四', age: 30 },
        ],
      },
    });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['company.employees[0].name', '张三']);
    expect(entries).toContainEqual(['company.employees[0].age', '25']);
    expect(entries).toContainEqual(['company.employees[1].name', '李四']);
    expect(entries).toContainEqual(['company.employees[1].age', '30']);
  });
});

// ============================================
// toFormData - 数组
// ============================================
describe('toFormData - 数组', () => {
  it('字符串数组', () => {
    const fd = toFormData({ tags: ['a', 'b', 'c'] });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['tags[0]', 'a']);
    expect(entries).toContainEqual(['tags[1]', 'b']);
    expect(entries).toContainEqual(['tags[2]', 'c']);
  });

  it('数字数组', () => {
    const fd = toFormData({ numbers: [1, 2, 3] });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['numbers[0]', '1']);
    expect(entries).toContainEqual(['numbers[1]', '2']);
    expect(entries).toContainEqual(['numbers[2]', '3']);
  });

  it('对象数组', () => {
    const fd = toFormData({
      users: [
        { name: '张三', age: 25 },
        { name: '李四', age: 30 },
      ],
    });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['users[0].name', '张三']);
    expect(entries).toContainEqual(['users[0].age', '25']);
    expect(entries).toContainEqual(['users[1].name', '李四']);
    expect(entries).toContainEqual(['users[1].age', '30']);
  });

  it('空数组', () => {
    const fd = toFormData({ items: [] });
    const entries = [...fd.entries()];
    expect(entries).toHaveLength(0);
  });

  it('混合数组', () => {
    const fd = toFormData({ mixed: [1, 'two', true] });
    const entries = [...fd.entries()];
    expect(entries).toContainEqual(['mixed[0]', '1']);
    expect(entries).toContainEqual(['mixed[1]', 'two']);
    expect(entries).toContainEqual(['mixed[2]', 'true']);
  });
});

// ============================================
// toFormData - File/Blob
// ============================================
describe('toFormData - File/Blob', () => {
  it('单个 File', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fd = toFormData({ file });

    const entries = [...fd.entries()];
    expect(entries).toHaveLength(1);
    expect(entries[0][0]).toBe('file');
    expect(entries[0][1]).toBeInstanceOf(File);
    expect((entries[0][1] as File).name).toBe('test.txt');
  });

  it('File 数组', () => {
    const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });
    const fd = toFormData({ files: [file1, file2] });

    const entries = [...fd.entries()];
    expect(entries).toHaveLength(2);
    expect(entries[0][0]).toBe('files[0]');
    expect(entries[0][1]).toBeInstanceOf(File);
    expect(entries[1][0]).toBe('files[1]');
    expect(entries[1][1]).toBeInstanceOf(File);
  });

  it('Blob 对象', () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const fd = toFormData({ blob });

    const entries = [...fd.entries()];
    expect(entries).toHaveLength(1);
    expect(entries[0][0]).toBe('blob');
    expect(entries[0][1]).toBeInstanceOf(Blob);
  });
});

// ============================================
// toFormData - 混合数据
// ============================================
describe('toFormData - 混合数据', () => {
  it('复杂表单数据', () => {
    const file = new File(['content'], 'avatar.png', { type: 'image/png' });
    const fd = toFormData({
      // 基础字段
      name: '张三',
      age: 25,
      active: true,

      // 嵌套对象
      profile: {
        bio: '软件工程师',
        level: 10,
      },

      // 数组
      tags: ['frontend', 'typescript'],
      scores: [95, 88, 92],

      // 嵌套数组
      projects: [
        { name: '项目A', duration: 30 },
        { name: '项目B', duration: 45 },
      ],

      // 文件
      avatar: file,
    });

    const entries = [...fd.entries()];

    // 基础字段
    expect(entries).toContainEqual(['name', '张三']);
    expect(entries).toContainEqual(['age', '25']);
    expect(entries).toContainEqual(['active', 'true']);

    // 嵌套对象
    expect(entries).toContainEqual(['profile.bio', '软件工程师']);
    expect(entries).toContainEqual(['profile.level', '10']);

    // 数组
    expect(entries).toContainEqual(['tags[0]', 'frontend']);
    expect(entries).toContainEqual(['tags[1]', 'typescript']);
    expect(entries).toContainEqual(['scores[0]', '95']);
    expect(entries).toContainEqual(['scores[1]', '88']);
    expect(entries).toContainEqual(['scores[2]', '92']);

    // 嵌套数组
    expect(entries).toContainEqual(['projects[0].name', '项目A']);
    expect(entries).toContainEqual(['projects[0].duration', '30']);
    expect(entries).toContainEqual(['projects[1].name', '项目B']);
    expect(entries).toContainEqual(['projects[1].duration', '45']);

    // 文件
    const avatarEntry = entries.find(([key]) => key === 'avatar');
    expect(avatarEntry).toBeDefined();
    expect(avatarEntry![1]).toBeInstanceOf(File);
  });

  it('文件上传场景', () => {
    const file1 = new File(['image1'], 'photo1.jpg', { type: 'image/jpeg' });
    const file2 = new File(['image2'], 'photo2.jpg', { type: 'image/jpeg' });
    const fd = toFormData({
      title: '我的相册',
      description: '旅行照片',
      cover: file1,
      photos: [file2],
      metadata: {
        location: '北京',
        date: new Date('2024-01-01'),
        tags: ['旅行', '风景'],
      },
    });

    const entries = [...fd.entries()];

    expect(entries).toContainEqual(['title', '我的相册']);
    expect(entries).toContainEqual(['description', '旅行照片']);
    expect(entries).toContainEqual(['metadata.location', '北京']);
    expect(entries).toContainEqual(['metadata.date', '2024-01-01T00:00:00.000Z']);
    expect(entries).toContainEqual(['metadata.tags[0]', '旅行']);
    expect(entries).toContainEqual(['metadata.tags[1]', '风景']);

    // File 检查
    const coverEntry = entries.find(([key]) => key === 'cover');
    expect(coverEntry![1]).toBeInstanceOf(File);
    expect((coverEntry![1] as File).name).toBe('photo1.jpg');

    const photoEntry = entries.find(([key]) => key === 'photos[0]');
    expect(photoEntry![1]).toBeInstanceOf(File);
  });
});

// ============================================
// toFormData - 扩展用法
// ============================================
describe('toFormData - 扩展用法', () => {
  it('合并到已有的 FormData', () => {
    const existingFd = new FormData();
    existingFd.append('existing', 'value');

    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fd = toFormData({ file }, existingFd);

    const entries = [...fd.entries()];
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(['existing', 'value']);
    expect(entries[1][0]).toBe('file');
    expect(entries[1][1]).toBeInstanceOf(File);
  });

  it('追加到已有的 FormData', () => {
    const existingFd = new FormData();
    existingFd.append('name', '原有值');
    existingFd.append('id', '123');

    const fd = toFormData({ extra: '新增' }, existingFd);

    const entries = [...fd.entries()];
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual(['name', '原有值']);  // 保留原有
    expect(entries[1]).toEqual(['id', '123']);      // 保留原有
    expect(entries[2]).toEqual(['extra', '新增']);  // 新增
  });

  it('FormData append 会追加同名字段', () => {
    const fd = new FormData();
    fd.append('name', '第一个值');
    fd.append('name', '第二个值');

    const entries = [...fd.entries()];
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(['name', '第一个值']);
    expect(entries[1]).toEqual(['name', '第二个值']);
  });
});

// ============================================
// flattenFormData - 辅助函数
// ============================================
describe('flattenFormData - 辅助函数', () => {
  it('基本展平', () => {
    const fd = new FormData();
    fd.append('name', '张三');
    fd.append('age', '25');

    const entries = flattenFormData(fd);
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual(['name', '张三']);
    expect(entries).toContainEqual(['age', '25']);
  });

  it('包含 File', () => {
    const fd = new FormData();
    fd.append('name', '张三');
    const file = new File(['content'], 'test.txt');
    fd.append('avatar', file);

    const entries = flattenFormData(fd);
    expect(entries).toHaveLength(2);
    expect(entries[1][0]).toBe('avatar');
    expect(entries[1][1]).toBeInstanceOf(File);
  });

  it('空 FormData', () => {
    const fd = new FormData();
    const entries = flattenFormData(fd);
    expect(entries).toHaveLength(0);
  });
});
