/**
 * 一键发布脚本 - 自动完成 typecheck、验证、构建、版本更新、changelog、提交、推送、创建标签
 * 
 * 用法:
 *   node scripts/release.js              # 交互模式
 *   node scripts/release.js 1.0.0        # 指定版本
 *   node scripts/release.js 1.0.0 "feat: 新功能"
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

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
function exec(command) {
  log.info(`执行: ${command}`);
  try {
    return execSync(command, { cwd: projectDir, stdio: 'inherit' });
  } catch {
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

// 更新 package.json 版本号
function updateVersion(newVersion) {
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log.success(`版本更新: ${pkg.version}`);
}

// 交互式提问
function question(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(q, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 解析命令行参数
const args = process.argv.slice(2);
let newVersion = '';
let commitMsg = '';
let needTag = true;
let interactive = true;

if (args.length > 0) {
  interactive = false;
  newVersion = args[0];
  commitMsg = args[1] || `chore: release v${newVersion}`;
  needTag = true; // 命令行模式默认打 tag
}

// 主流程
async function main() {
  console.log('');
  console.log(`${colors.blue}🚀 axios-request 一键发布${colors.reset}`);
  console.log('========================================');

  // 交互模式
  if (interactive) {
    const currentVersion = getCurrentVersion();
    log.info(`当前版本: ${currentVersion}`);

    console.log('  1) Patch - Bug修复');
    console.log('  2) Minor - 新功能');
    console.log('  3) Major - 破坏性更新');
    console.log('  4) 自定义版本');

    const choice = (await question('请选择 [1]: ')) || '1';
    let versionType = 'patch';

    switch (choice.trim()) {
      case '2': versionType = 'minor'; break;
      case '3': versionType = 'major'; break;
      case '4': newVersion = await question('版本号: '); break;
    }

    if (!newVersion) newVersion = suggestVersion(currentVersion, versionType);
    commitMsg = (await question(`提交信息 [chore: release v${newVersion}]: `)) || `chore: release v${newVersion}`;

    // 询问是否打 tag
    const tagAnswer = (await question('是否打标签发布? [Y]: ')) || 'Y';
    needTag = tagAnswer.toLowerCase() === 'y';

    if (!needTag) {
      log.warn('不发布，跳过');
      process.exit(0);
    }
  }

  // 验证版本号
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    log.error('版本号格式不正确');
    process.exit(1);
  }

  console.log(`\n新版本: ${newVersion}  |  ${commitMsg}\n`);

  if (interactive) {
    const confirm = (await question('确认发布? [Y]: ')) || 'Y';
    if (confirm.toLowerCase() !== 'y') { log.warn('已取消'); process.exit(0); }
  }

  // Step 1: TypeCheck
  log.info('TypeCheck...');
  exec('npm run typecheck');
  log.success('TypeCheck 通过');

  // Step 2: Lint
  log.info('Lint...');
  exec('npm run lint');
  log.success('Lint 通过');

  // Step 3: Test
  log.info('运行测试...');
  exec('npm run test');
  log.success('测试通过');

  // Step 4: 构建
  log.info('构建项目...');
  exec('npm run build');
  log.success('构建成功');

  // Step 5: 更新版本号
  log.info('更新版本号...');
  updateVersion(newVersion);

  // Step 6: 生成 Changelog
  log.info('生成 Changelog...');
  exec('node scripts/changelog.js');
  log.success('Changelog 生成完成');

  // Step 7: 提交
  log.info('提交代码...');
  exec('git add -A');
  exec(`git commit -m "${commitMsg}"`);
  log.success('提交完成');

  // Step 8: 推送到远程仓库
  const branch = getCurrentBranch();
  log.info(`推送 ${branch}...`);
  exec(`git push origin ${branch}`);

  if (remoteExists('github')) {
    exec(`git push github ${branch}`);
  }

  // Step 9: 创建并推送标签
  const tag = `v${newVersion}`;
  log.info(`创建标签 ${tag}...`);
  exec(`git tag -a ${tag} -m "Release ${newVersion}"`);
  exec(`git push origin ${tag}`);

  if (remoteExists('github')) {
    exec(`git push github ${tag}`);
  }

  console.log('\n========================================');
  log.success('发布完成！');
  console.log('========================================');
  console.log('\nGitHub Actions 将自动: 安装依赖 → 测试 → 构建 → 发布npm\n');
}

main().catch(err => log.error(`失败: ${err.message}`));
