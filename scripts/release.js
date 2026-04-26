/**
 * 一键发布脚本 - 跨平台版本 (Windows/Mac/Linux)
 * 
 * 用法:
 *   node scripts/release.js              # 交互模式
 *   node scripts/release.js 1.0.0        # 指定版本
 *   node scripts/release.js 1.0.0 "feat: 新功能"
 * 
 * 或通过 npm:
 *   npm run publish              # 交互模式
 *   npm run publish -- 1.0.0    # 指定版本
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.join(__dirname, '..');

// ANSI 颜色
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`)
};

// 执行命令
function exec(command, options = {}) {
  log.info(`执行: ${command}`);
  try {
    return execSync(command, {
      cwd: projectDir,
      stdio: 'inherit',
      ...options
    });
  } catch (error) {
    log.error(`命令执行失败: ${command}`);
    process.exit(1);
  }
}

// 检查远程仓库是否存在
function remoteExists(name) {
  try {
    execSync(`git remote get-url ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// 获取当前分支
function getCurrentBranch() {
  return execSync('git symbolic-ref --short HEAD', { encoding: 'utf-8' }).trim();
}

// 获取当前版本
function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

// 计算建议版本
function suggestVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    default: return `${major}.${minor}.${patch + 1}`;
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
let newVersion = '';
let commitMsg = '';
let interactive = true;

if (args.length > 0) {
  interactive = false;
  newVersion = args[0];
  commitMsg = args[1] || `chore: release v${newVersion}`;
}

// 主流程
async function main() {
  console.log('');
  console.log(`${colors.blue}🚀 axios-request 一键发布工具${colors.reset}`);
  console.log('========================================');
  console.log('');

  // 交互模式
  if (interactive) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (q) => new Promise(resolve => rl.question(q, resolve));

    const currentVersion = getCurrentVersion();
    log.info(`当前版本: ${currentVersion}`);

    console.log('');
    console.log('请选择版本类型:');
    console.log('  1) Patch - Bug修复');
    console.log('  2) Minor - 新功能');
    console.log('  3) Major - 破坏性更新');
    console.log('  4) 自定义版本');
    console.log('');

    const choice = (await question('请输入选项 [1]: ')) || '1';
    let versionType = 'patch';

    switch (choice.trim()) {
      case '2': versionType = 'minor'; break;
      case '3': versionType = 'major'; break;
      case '4':
        newVersion = await question('请输入版本号: ');
        break;
      default: versionType = 'patch';
    }

    if (!newVersion) {
      newVersion = suggestVersion(currentVersion, versionType);
    }

    commitMsg = (await question(`提交信息 [chore: release v${newVersion}]: `)) || `chore: release v${newVersion}`;
    rl.close();
  }

  // 验证版本号格式
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
  if (!semverRegex.test(newVersion)) {
    log.error('版本号格式不正确，请使用语义化版本号 (如: 1.0.0, 1.0.0-beta.1)');
    process.exit(1);
  }

  console.log('');
  console.log('========================================');
  log.info('发布配置');
  console.log('========================================');
  console.log(`新版本: ${newVersion}`);
  console.log(`提交信息: ${commitMsg}`);
  console.log('');

  if (interactive) {
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const confirm = (await question('确认发布? [Y/n]: ')) || 'Y';
    rl.close();

    if (confirm.toLowerCase() !== 'y') {
      log.warn('已取消发布');
      process.exit(0);
    }
  }

  // Step 1: 验证
  console.log('');
  console.log('========================================');
  log.info('Step 1: 验证代码');
  console.log('========================================');
  exec('npm run validate');
  log.success('代码验证通过');

  // Step 2: 构建
  console.log('');
  console.log('========================================');
  log.info('Step 2: 构建项目');
  console.log('========================================');
  exec('npm run build');
  log.success('构建成功');

  // Step 3: 更新版本号
  console.log('');
  console.log('========================================');
  log.info('Step 3: 更新版本号');
  console.log('========================================');
  exec(`node scripts/release.js --version ${newVersion}`);
  log.success('版本更新完成');

  // Step 4: 生成 Changelog
  console.log('');
  console.log('========================================');
  log.info('Step 4: 生成 Changelog');
  console.log('========================================');
  exec('node scripts/changelog.js');
  log.success('Changelog 生成完成');

  // Step 5: 提交
  console.log('');
  console.log('========================================');
  log.info('Step 5: 提交更改');
  console.log('========================================');
  exec('git add -A');
  exec(`git commit -m "${commitMsg}"`);
  log.success('提交完成');

  // Step 6: 推送
  console.log('');
  console.log('========================================');
  log.info('Step 6: 推送到远程仓库');
  console.log('========================================');
  const branch = getCurrentBranch();

  log.info('推送到 Gitee...');
  exec(`git push origin ${branch}`);

  if (remoteExists('github')) {
    log.info('推送到 GitHub...');
    exec(`git push github ${branch}`);
  } else {
    log.warn('GitHub 远程仓库未配置，跳过');
  }
  log.success('推送完成');

  // Step 7: 打标签
  console.log('');
  console.log('========================================');
  log.info('Step 7: 创建并推送标签');
  console.log('========================================');
  const tag = `v${newVersion}`;
  exec(`git tag -a ${tag} -m "Release ${newVersion}"`);
  exec(`git push origin ${tag}`);

  if (remoteExists('github')) {
    exec(`git push github ${tag}`);
  }
  log.success(`标签 ${tag} 已推送`);

  // 完成
  console.log('');
  console.log('========================================');
  log.success('发布完成！');
  console.log('========================================');
  console.log('');
  log.info('GitHub Actions 将自动执行以下操作:');
  console.log('  - 安装依赖');
  console.log('  - 运行测试');
  console.log('  - 构建项目');
  console.log('  - 发布到 npm');
  console.log('');
}

main().catch(err => {
  log.error(`发布失败: ${err.message}`);
  process.exit(1);
});
