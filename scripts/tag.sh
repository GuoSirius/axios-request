#!/bin/sh
#
# 创建并推送版本标签
# 用法: ./scripts/tag.sh 1.0.0
#

if [ -z "$1" ]; then
  echo "请提供版本号"
  echo "用法: ./scripts/tag.sh 1.0.0"
  exit 1
fi

VERSION="$1"
TAG="v$VERSION"

echo "🏷️  创建标签: $TAG"
git tag -a $TAG -m "Release $VERSION"

echo "🚀 推送标签到 Gitee..."
git push origin $TAG

echo "🚀 推送标签到 GitHub..."
if git remote get-url github >/dev/null 2>&1; then
  git push github $TAG
else
  echo "⚠️ GitHub 远程仓库未配置，跳过"
fi

echo "✅ 完成！标签 $TAG 已推送"
echo "💡 GitHub Actions 将自动执行发布流程"
