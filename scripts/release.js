/**
 * 版本发布脚本
 * 自动完成：验证 → 构建 → 版本更新 → Changelog → Git 提交 → 推送 → 打标签
 *
 * 使用方式:
 *   npm run release              # 交互式发布
 *   node scripts/release.js      # 交互式发布
 *   node scripts/release.js patch # 自动 patch 版本
 *   node scripts/release.js minor # 自动 minor 版本
 *   node scripts/release.js major # 自动 major 版本
 *   node scripts/release.js 1.2.3 # 指定版本号
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.join(__dirname, '..');

// ANSI 颜色
const c = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${c.blue}ℹ${c.reset} ${msg}`),
  success: (msg) => console.log(`${c.green}✓${c.reset} ${msg}`),
  warn: (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
  error: (msg) => console.log(`${c.red}✗${c.reset} ${msg}`)
};

// 执行命令
function exec(command, options = {}) {
  log.info(`执行: ${command}`);
  try {
    execSync(command, { cwd: projectDir, stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    log.error(`命令执行失败: ${command}`);
    return false;
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
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'major': return `${major + 1}.0.0`;
    case 'patch':
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

// 打印标题
function printBanner() {
  console.log('');
  console.log(`${c.cyan}${c.bold}╔═══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}║     axios-request 版本发布工具            ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}╚═══════════════════════════════════════════╝${c.reset}`);
  console.log('');
}

// 解析命令行参数
const args = process.argv.slice(2);
let newVersion = '';
let commitMsg = '';
let autoMode = false;

// 自动模式: 根据参数自动选择版本
if (args.length > 0) {
  autoMode = true;
  const arg = args[0].toLowerCase();

  if (['patch', 'minor', 'major'].includes(arg)) {
    newVersion = suggestVersion(getCurrentVersion(), arg);
  } else if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(arg)) {
    newVersion = arg;
  } else {
    log.error(`无效的参数: ${arg}`);
    console.log('');
    console.log('用法:');
    console.log('  node scripts/release.js           # 交互式发布');
    console.log('  node scripts/release.js patch      # 自动 patch 版本');
    console.log('  node scripts/release.js minor      # 自动 minor 版本');
    console.log('  node scripts/release.js major      # 自动 major 版本');
    console.log('  node scripts/release.js 1.2.3      # 指定版本号');
    process.exit(1);
  }

  commitMsg = `chore(release): v${newVersion}`;
  log.info(`自动模式: ${args[0]} → ${newVersion}`);
}

// 主流程
async function main() {
  printBanner();

  // 检查远程仓库
  const hasOrigin = remoteExists('origin');
  const hasGithub = remoteExists('github');

  if (!hasOrigin) {
    log.error('未找到 origin 远程仓库');
    process.exit(1);
  }

  if (getCurrentBranch() !== 'main') {
    log.warn(`当前不在 main 分支 (${getCurrentBranch()})，发布应在 main 分支进行`);
    const confirm = await question('继续发布? [y/N]: ');
    if (confirm.toLowerCase() !== 'y') {
      log.info('已取消');
      process.exit(0);
    }
  }

  // 交互模式: 询问版本
  if (!autoMode) {
    const currentVersion = getCurrentVersion();
    log.info(`当前版本: ${c.bold}${currentVersion}${c.reset}`);
    console.log('');
    console.log(`  ${c.green}1${c.reset}) Patch  ${c.dim}Bug 修复${c.reset}    ${currentVersion} → ${suggestVersion(currentVersion, 'patch')}`);
    console.log(`  ${c.green}2${c.reset}) Minor  ${c.dim}新功能${c.reset}      ${currentVersion} → ${suggestVersion(currentVersion, 'minor')}`);
    console.log(`  ${c.green}3${c.reset}) Major  ${c.dim}破坏性变更${c.reset}  ${currentVersion} → ${suggestVersion(currentVersion, 'major')}`);
    console.log(`  ${c.green}4${c.reset}) 自定义版本`);
    console.log('');

    const choice = (await question('请选择版本类型 [1]: ')) || '1';
    const versionMap = { '1': 'patch', '2': 'minor', '3': 'major' };

    if (choice === '4') {
      newVersion = await question('请输入版本号 (如 1.2.3): ');
    } else {
      newVersion = suggestVersion(currentVersion, versionMap[choice.trim()] || 'patch');
    }

    commitMsg = (await question(`提交信息 [chore(release): v${newVersion}]: `)) || `chore(release): v${newVersion}`;
  }

  // 验证版本号
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(newVersion)) {
    log.error(`版本号格式不正确: ${newVersion}`);
    process.exit(1);
  }

  console.log('');
  console.log(`${c.bold}发布信息${c.reset}`);
  console.log('─'.repeat(45));
  console.log(`  版本:   ${c.green}${c.bold}${newVersion}${c.reset}`);
  console.log(`  提交:   ${commitMsg}`);
  console.log(`  仓库:   origin${hasGithub ? ', github' : ''}`);
  console.log('─'.repeat(45));
  console.log('');

  // 确认
  if (!autoMode) {
    const confirm = (await question('确认发布? [Y]: ')) || 'Y';
    if (confirm.toLowerCase() !== 'y') {
      log.info('已取消');
      process.exit(0);
    }
  }

  // ========== Step 1: 验证代码质量 ==========
  console.log('');
  log.info(`${c.bold}Step 1/${c.dim} 验证代码质量${c.reset}`);

  if (!exec('npm run typecheck')) {
    log.error('TypeCheck 失败');
    process.exit(1);
  }
  log.success('TypeCheck 通过');

  if (!exec('npm run lint')) {
    log.error('Lint 失败');
    process.exit(1);
  }
  log.success('Lint 通过');

  if (!exec('npm run test')) {
    log.error('测试失败');
    process.exit(1);
  }
  log.success('测试通过');

  // ========== Step 2: 构建 ==========
  console.log('');
  log.info(`${c.bold}Step 2/${c.dim} 构建项目${c.reset}`);

  if (!exec('npm run build')) {
    log.error('构建失败');
    process.exit(1);
  }
  log.success('构建成功');

  // ========== Step 3: 更新版本 ==========
  console.log('');
  log.info(`${c.bold}Step 3/${c.dim} 更新版本${c.reset}`);
  updateVersion(newVersion);

  // ========== Step 4: 生成 Changelog ==========
  console.log('');
  log.info(`${c.bold}Step 4/${c.dim} 生成 Changelog${c.reset}`);

  exec('node scripts/changelog.js');

  // ========== Step 5: Git 提交 ==========
  console.log('');
  log.info(`${c.bold}Step 5/${c.dim} Git 提交${c.reset}`);

  exec('git add -A');

  // 检查是否有变更
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (!status.trim()) {
    log.warn('没有需要提交的变更');
    process.exit(0);
  }

  exec(`git commit -m "${commitMsg}"`);
  log.success('提交完成');

  // ========== Step 6: 推送 ==========
  console.log('');
  log.info(`${c.bold}Step 6/${c.dim} 推送到远程${c.reset}`);

  const branch = getCurrentBranch();
  log.info(`推送 ${branch} 分支...`);

  exec(`git push origin ${branch}`);

  if (hasGithub) {
    log.info(`推送 ${branch} 分支到 github...`);
    exec(`git push github ${branch}`);
  }

  // ========== Step 7: 打标签 ==========
  console.log('');
  log.info(`${c.bold}Step 7/${c.dim} 创建标签${c.reset}`);

  const tag = `v${newVersion}`;
  log.info(`创建标签 ${tag}...`);

  try {
    exec(`git tag -a ${tag} -m "Release ${tag}"`);
    exec(`git push origin ${tag}`);

    if (hasGithub) {
      exec(`git push github ${tag}`);
    }

    log.success(`标签 ${tag} 推送成功`);
  } catch {
    log.warn('标签可能已存在，跳过');
  }

  // ========== 完成 ==========
  console.log('');
  console.log(`${c.green}${c.bold}╔═══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.green}${c.bold}║     发布完成！                              ║${c.reset}`);
  console.log(`${c.green}${c.bold}╚═══════════════════════════════════════════╝${c.reset}`);
  console.log('');
  console.log(`  ${c.cyan}版本: ${c.reset}${c.bold}${newVersion}${c.reset}`);
  console.log(`  ${c.cyan}标签: ${c.reset}${c.bold}${tag}${c.reset}`);
  console.log('');

  if (hasGithub) {
    console.log(`${c.yellow}提示: ${c.reset}GitHub Actions 将自动构建并发布 npm`);
  }
}

main().catch((err) => {
  log.error(`发布失败: ${err.message}`);
  process.exit(1);
});
