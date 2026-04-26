/**
 * Changelog 生成脚本
 * 基于 git log 和 conventional commits 格式生成 changelog
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 获取最新版本的 tag
function getLatestTag() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
    return tag;
  } catch {
    return null;
  }
}

// 获取 commit 历史
function getCommits(sinceTag) {
  const range = sinceTag ? `${sinceTag}..HEAD` : '--all';
  try {
    const log = execSync(`git log ${range} --pretty=format:"%s|%h|%an"`, { encoding: 'utf-8' });
    return log.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// 解析 commit 类型
function parseCommit(commit) {
  const [message, hash, author] = commit.split('|');
  
  // 匹配 conventional commit 格式
  const match = message.match(/^(\w+)(\(.+\))?:\s*(.+)$/);
  
  if (match) {
    return {
      type: match[1],
      scope: match[2]?.replace(/[()]/g, ''),
      subject: match[3],
      hash,
      author,
      raw: message
    };
  }
  
  return {
    type: 'other',
    scope: null,
    subject: message,
    hash,
    author,
    raw: message
  };
}

// 类型分组配置
const typeConfig = {
  feat: { title: '新功能', emoji: '✨' },
  fix: { title: 'Bug 修复', emoji: '🐛' },
  perf: { title: '性能优化', emoji: '⚡' },
  refactor: { title: '代码重构', emoji: '♻️' },
  docs: { title: '文档更新', emoji: '📝' },
  style: { title: '代码格式', emoji: '💄' },
  test: { title: '测试相关', emoji: '✅' },
  chore: { title: '构建/工具', emoji: '🔧' },
  ci: { title: 'CI/CD', emoji: '🚀' },
  revert: { title: '回滚', emoji: '⏪' },
  other: { title: '其他', emoji: '📌' }
};

// 生成 changelog
function generateChangelog(commits) {
  const groups = {};
  
  // 分组
  for (const commit of commits) {
    const parsed = parseCommit(commit);
    const type = parsed.type;
    
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(parsed);
  }
  
  // 生成 markdown
  const lines = [];
  const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;
  const date = new Date().toISOString().split('T')[0];
  
  lines.push(`# Changelog`);
  lines.push('');
  lines.push(`## ${version} (${date})`);
  lines.push('');
  
  // 按优先级排序输出
  const order = ['feat', 'fix', 'perf', 'refactor', 'docs', 'style', 'test', 'chore', 'ci', 'revert', 'other'];
  
  for (const type of order) {
    if (!groups[type]) continue;
    
    const config = typeConfig[type];
    lines.push(`### ${config.emoji} ${config.title}`);
    lines.push('');
    
    for (const commit of groups[type]) {
      if (type === 'other') {
        lines.push(`- ${commit.subject} (${commit.hash})`);
      } else {
        lines.push(`- ${commit.subject}`);
      }
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// 主函数
function main() {
  const latestTag = getLatestTag();
  console.log(`最新 tag: ${latestTag || '无'}`);
  
  const commits = getCommits(latestTag);
  console.log(`获取到 ${commits.length} 条提交记录`);
  
  const changelog = generateChangelog(commits);
  
  // 读取现有的 CHANGELOG.md
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  let existingContent = '';
  
  if (fs.existsSync(changelogPath)) {
    existingContent = fs.readFileSync(changelogPath, 'utf-8');
    // 移除旧的自动生成部分，保留手动部分
    const manualEndIndex = existingContent.indexOf('<!-- AUTO_GENERATED -->');
    if (manualEndIndex !== -1) {
      existingContent = existingContent.substring(0, manualEndIndex).trim();
    }
  }
  
  // 写入新的 changelog
  const newContent = `${existingContent}

<!-- AUTO_GENERATED -->

${changelog}`;

  fs.writeFileSync(changelogPath, newContent);
  console.log('✅ Changelog 生成完成');
}

main();
