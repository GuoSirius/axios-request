#!/bin/sh
#
# 一键发布脚本 - 自动完成验证、版本更新、changelog、提交、推送、标签
# 用法:
#   ./scripts/release.sh              # 交互模式
#   ./scripts/release.sh 1.0.0       # 指定版本，自动生成提交信息
#   ./scripts/release.sh 1.0.0 "feat: 新功能"  # 指定版本和提交信息
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo "${GREEN}✅ $1${NC}"; }
log_warn() { echo "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo "${RED}❌ $1${NC}"; }

# 获取项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# 解析参数
NEW_VERSION=""
COMMIT_MSG=""
INTERACTIVE=false

if [ -z "$1" ]; then
  INTERACTIVE=true
else
  NEW_VERSION="$1"
  if [ -z "$2" ]; then
    COMMIT_MSG="chore: release v$NEW_VERSION"
  else
    COMMIT_MSG="$2"
  fi
fi

# 交互模式
if [ "$INTERACTIVE" = true ]; then
  echo ""
  echo "🚀 axios-request 一键发布工具"
  echo "================================"
  echo ""

  # 获取当前版本
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  log_info "当前版本: $CURRENT_VERSION"

  # 计算建议版本
  MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
  MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
  PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)
  SUGGEST_PATCH=$((PATCH + 1))
  SUGGEST_VERSION="$MAJOR.$MINOR.$SUGGEST_PATCH"

  echo ""
  echo "请选择版本类型:"
  echo "  1) Patch ($MAJOR.$MINOR.$SUGGEST_PATCH) - Bug修复"
  echo "  2) Minor ($MAJOR.$((MINOR + 1)).0) - 新功能"
  echo "  3) Major ($((MAJOR + 1)).0.0) - 破坏性更新"
  echo "  4) 自定义版本"
  echo ""

  read -p "请输入选项 [1]: " CHOICE
  CHOICE=${CHOICE:-1}

  case $CHOICE in
    1) NEW_VERSION="$SUGGEST_VERSION";;
    2) NEW_VERSION="$MAJOR.$((MINOR + 1)).0";;
    3) NEW_VERSION="$((MAJOR + 1)).0.0";;
    4)
      read -p "请输入版本号: " NEW_VERSION
      ;;
    *)
      log_error "无效选项"
      exit 1
      ;;
  esac

  echo ""
  read -p "提交信息 [chore: release v$NEW_VERSION]: " INPUT_MSG
  COMMIT_MSG=${INPUT_MSG:-"chore: release v$NEW_VERSION"}
fi

# 验证版本号格式
SEMVER_REGEX='^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'
if ! echo "$NEW_VERSION" | grep -qE "$SEMVER_REGEX"; then
  log_error "版本号格式不正确，请使用语义化版本号 (如: 1.0.0, 1.0.0-beta.1)"
  exit 1
fi

echo ""
echo "========================================"
log_info "发布配置"
echo "========================================"
echo "新版本: $NEW_VERSION"
echo "提交信息: $COMMIT_MSG"
echo ""

# 确认操作
if [ "$INTERACTIVE" = true ]; then
  read -p "确认发布? [Y/n]: " CONFIRM
  CONFIRM=${CONFIRM:-Y}
  if [ "$CONFIRM" != "Y" ] && [ "$CONFIRM" != "y" ]; then
    log_warn "已取消发布"
    exit 0
  fi
fi

echo ""
echo "========================================"
log_info "Step 1: 验证代码"
echo "========================================"
npm run validate || {
  log_error "代码验证失败，请修复后再试"
  exit 1
}
log_success "代码验证通过"

echo ""
echo "========================================"
log_info "Step 2: 构建项目"
echo "========================================"
npm run build || {
  log_error "构建失败"
  exit 1
}
log_success "构建成功"

echo ""
echo "========================================"
log_info "Step 3: 更新版本号"
echo "========================================"
node scripts/release.js --version "$NEW_VERSION"
log_success "版本更新完成"

echo ""
echo "========================================"
log_info "Step 4: 生成 Changelog"
echo "========================================"
node scripts/changelog.js
log_success "Changelog 生成完成"

echo ""
echo "========================================"
log_info "Step 5: 提交更改"
echo "========================================"
git add -A
git commit -m "$COMMIT_MSG"
log_success "提交完成"

echo ""
echo "========================================"
log_info "Step 6: 推送到远程仓库"
echo "========================================"
BRANCH=$(git symbolic-ref --short HEAD)

log_info "推送到 Gitee..."
git push origin "$BRANCH"

if git remote get-url github >/dev/null 2>&1; then
  log_info "推送到 GitHub..."
  git push github "$BRANCH"
else
  log_warn "GitHub 远程仓库未配置，跳过"
fi
log_success "推送完成"

echo ""
echo "========================================"
log_info "Step 7: 创建并推送标签"
echo "========================================"
TAG="v$NEW_VERSION"
git tag -a "$TAG" -m "Release $NEW_VERSION"
git push origin "$TAG"

if git remote get-url github >/dev/null 2>&1; then
  git push github "$TAG"
fi
log_success "标签 $TAG 已推送"

echo ""
echo "========================================"
log_success "发布完成！"
echo "========================================"
echo ""
log_info "GitHub Actions 将自动执行以下操作:"
echo "  - 安装依赖"
echo "  - 运行测试"
echo "  - 构建项目"
echo "  - 发布到 npm"
echo ""
log_info "查看发布状态: https://github.com/your-username/axios-request/actions"
echo ""
