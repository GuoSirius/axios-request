/**
 * 发布版本更新脚本
 * 用法: node scripts/release.js --version <version>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 解析命令行参数
const args = process.argv.slice(2);
const versionIndex = args.indexOf('--version');

if (versionIndex === -1 || !args[versionIndex + 1]) {
  console.error('请提供版本号: node scripts/release.js --version <version>');
  console.error('例如: node scripts/release.js --version 1.0.0');
  process.exit(1);
}

const newVersion = args[versionIndex + 1];

// 验证版本号格式
const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
if (!semverRegex.test(newVersion)) {
  console.error('版本号格式不正确，请使用语义化版本号 (如: 1.0.0, 1.0.0-beta.1)');
  process.exit(1);
}

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// 读取 package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

console.log(`更新版本号: ${packageJson.version} -> ${newVersion}`);

// 更新版本号
packageJson.version = newVersion;

// 写回 package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('✅ 版本号更新完成');
