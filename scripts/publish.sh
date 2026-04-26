#!/bin/sh
#
# 一键提交并推送到所有远程仓库
# 用法: ./scripts/publish.sh "commit message"
#

if [ -z "$1" ]; then
  echo "请提供提交信息"
  echo "用法: ./scripts/publish.sh \"commit message\""
  exit 1
fi

COMMIT_MSG="$1"
BRANCH=$(git symbolic-ref --short HEAD)

echo "📝 正在提交..."
git add -A
git commit -m "$COMMIT_MSG"

echo "🚀 正在推送到 Gitee..."
git push origin $BRANCH

echo "🚀 正在推送到 GitHub..."
if git remote get-url github >/dev/null 2>&1; then
  git push github $BRANCH
else
  echo "⚠️ GitHub 远程仓库未配置，跳过"
fi

echo "✅ 完成！"
