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

// 文本换行（保持缩进）
function wrapText(text, maxLength = 80, indent = '  ') {
  const lines = [];
  let currentLine = '';

  const words = text.split(' ');
  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxLength) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = indent + word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

// 生成当前版本的 changelog 内容
function generateVersionChangelog(commits, version, date) {
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
  let globalIndex = 1;

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
      const numStr = String(globalIndex).padStart(2, '0');
      const prefix = `**${numStr}.** `;
      const prefixLen = prefix.length;

      if (type === 'other') {
        const subject = `${commit.subject} (${commit.hash})`;
        lines.push(wrapText(prefix + subject, 80, ' '.repeat(prefixLen)));
      } else {
        lines.push(wrapText(prefix + commit.subject, 80, ' '.repeat(prefixLen)));
      }
      globalIndex++;
    }
  }

  return lines.join('\n');
}

// 主函数
function main() {
  // 支持命令行参数
  //   node scripts/changelog.js [version] [--replace]
  //   - version: 版本号（CI 环境使用）
  //   - --replace: 替换模式，只更新当前版本内容，不重新生成历史
  const args = process.argv.slice(2);
  const cliVersion = args[0];
  const replaceMode = args.includes('--replace');

  const latestTag = getLatestTag();
  console.log(`最新 tag: ${latestTag || '无'}`);

  const commits = getCommits(latestTag);
  console.log(`获取到 ${commits.length} 条提交记录`);

  if (commits.length === 0) {
    console.log('没有新的提交，跳过 changelog 生成');
    return;
  }

  // 优先使用命令行传入的版本号，否则从 package.json 读取
  const version = cliVersion || JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;
  console.log(`生成版本: ${version}`);
  const date = new Date().toISOString().split('T')[0];

  const changelog = generateVersionChangelog(commits, version, date);

  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

  if (replaceMode) {
    // 替换模式：只更新当前版本内容，保留历史
    if (fs.existsSync(changelogPath)) {
      const fullContent = fs.readFileSync(changelogPath, 'utf-8');
      const autoIndex = fullContent.indexOf('<!-- AUTO_GENERATED -->');

      if (autoIndex !== -1) {
        const beforeAuto = fullContent.substring(0, autoIndex);
        // 查找当前版本的起始位置（## version (date)）
        const existingVersionIndex = fullContent.indexOf(`## ${version} (${date})`, autoIndex);

        if (existingVersionIndex !== -1) {
          // 找到已存在的版本，替换它
          const endOfVersion = findEndOfVersion(fullContent, existingVersionIndex);
          const newAutoContent = fullContent.substring(autoIndex + '<!-- AUTO_GENERATED -->'.length, existingVersionIndex).trim()
            + (fullContent.substring(autoIndex + '<!-- AUTO_GENERATED -->'.length, existingVersionIndex).trim() ? '\n\n' : '')
            + changelog
            + (endOfVersion ? '\n\n' + fullContent.substring(endOfVersion).trim() : '');
          fs.writeFileSync(changelogPath, beforeAuto + '<!-- AUTO_GENERATED -->\n\n' + newAutoContent.trim() + '\n');
        } else {
          // 未找到当前版本，在最前面插入
          const oldAutoContent = fullContent.substring(autoIndex + '<!-- AUTO_GENERATED -->'.length).trim();
          const newAutoContent = changelog + (oldAutoContent ? '\n\n' + oldAutoContent : '');
          fs.writeFileSync(changelogPath, beforeAuto + '<!-- AUTO_GENERATED -->\n\n' + newAutoContent + '\n');
        }
      } else {
        // 没有标记，创建标记
        fs.writeFileSync(changelogPath, fullContent.trim() + '\n\n<!-- AUTO_GENERATED -->\n\n' + changelog + '\n');
      }
    } else {
      fs.writeFileSync(changelogPath, '<!-- AUTO_GENERATED -->\n\n' + changelog + '\n');
    }
  } else {
    // 完整模式：重新生成所有版本（本地使用）
    let manualContent = '';
    let oldAutoContent = '';

    if (fs.existsSync(changelogPath)) {
      const fullContent = fs.readFileSync(changelogPath, 'utf-8');
      const autoIndex = fullContent.indexOf('<!-- AUTO_GENERATED -->');
      if (autoIndex !== -1) {
        manualContent = fullContent.substring(0, autoIndex).trim();
        oldAutoContent = fullContent.substring(autoIndex + '<!-- AUTO_GENERATED -->'.length).trim();
      } else {
        oldAutoContent = fullContent.trim();
      }
    }

    const header = manualContent ? `${manualContent}\n\n` : '';
    const newContent = `${header}<!-- AUTO_GENERATED -->

${changelog}
${oldAutoContent ? '\n\n' + oldAutoContent : ''}`;

    fs.writeFileSync(changelogPath, newContent);
  }

  console.log('✅ Changelog 生成完成');
}

// 转义正则特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 查找版本块的结束位置（下一个 ## 或文件末尾）
function findEndOfVersion(content, startIndex) {
  const nextVersion = content.indexOf('\n## ', startIndex + 4);
  return nextVersion !== -1 ? nextVersion : -1;
}

main();
