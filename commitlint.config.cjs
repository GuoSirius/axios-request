module.exports = {
  extends: ['@commitlint/config-conventional'],

  // 提交信息格式: <type>(<scope>): <subject>
  // 示例: feat(core): add token refresh feature

  rules: {
    // 必须的类型
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug 修复
        'docs',     // 文档更新
        'style',    // 代码格式（不影响功能）
        'refactor', // 重构（不是修复也不是新功能）
        'perf',     // 性能优化
        'test',     // 测试相关
        'build',    // 构建或依赖更新
        'ci',       // CI/CD 配置
        'chore',    // 其他修改（不涉及源码或测试）
        'revert',   // 回滚
      ],
    ],

    // 类型必须小写
    'type-case': [2, 'always', 'lower-case'],

    // 类型不能为空
    'type-empty': [2, 'never'],

    // 主题不能为空
    'subject-empty': [2, 'never'],

    // 主题不能以句号结尾
    'subject-full-stop': [2, 'never', '.'],

    // 标题最大长度
    'header-max-length': [2, 'always', 72],

    // scope 建议配置（仅警告，不阻止）
    'scope-enum': [
      2,
      'always',
      [
        'core',      // 核心模块
        'types',     // 类型定义
        'utils',     // 工具函数
        'test',      // 测试
        'docs',      // 文档
        'workflow',  // 工作流
        'config',    // 配置文件
        'deps',      // 依赖
        'release',   // 发布相关
      ],
    ],
  },

  // 支持自定义 prompt（用于交互式提交）
  prompt: {
    messages: {
      type: "选择提交类型:",
      customScope: "请输入修改范围 (可选):",
      subject: "简要描述本次修改 (必填):",
      body: "详细描述本次修改 (可选，按 Enter 跳过):",
      breaking: "是否有破坏性变更? (可选，按 Enter 跳过)",
      footerPrefixesSelect: "选择关联的 issue 类型 (可选):",
      customFooterPrefix: "输入 issue 前缀 (如 #, fix #):",
      footer: "请输入关联的 issue (可选):",
      generatingByAI: "正在使用 AI 生成符合规范的提交信息...",
      generatedSelectByAI: "请选择或修改 AI 生成的提交信息:",
      confirmCommit: "确认使用以上提交信息?",
    },
    types: [
      { value: 'feat', name: 'feat:     新功能', description: '新增功能' },
      { value: 'fix', name: 'fix:      Bug 修复', description: '修复问题' },
      { value: 'docs', name: 'docs:     文档更新', description: '仅文档修改' },
      { value: 'style', name: 'style:    代码格式', description: '不影响代码含义的修改' },
      { value: 'refactor', name: 'refactor: 代码重构', description: '重构代码' },
      { value: 'perf', name: 'perf:     性能优化', description: '提升性能' },
      { value: 'test', name: 'test:     测试', description: '添加或修改测试' },
      { value: 'build', name: 'build:    构建', description: '构建或依赖变更' },
      { value: 'ci', name: 'ci:       CI/CD', description: 'CI/CD 配置修改' },
      { value: 'chore', name: 'chore:    其他', description: '其他修改' },
      { value: 'revert', name: 'revert:   回滚', description: '回滚之前的提交' },
    ],
    useEmoji: false,
    scopes: ['core', 'types', 'utils', 'test', 'docs', 'workflow', 'config', 'deps', 'release'],
  },
};
