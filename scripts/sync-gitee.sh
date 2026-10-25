#!/bin/bash
# 将发布资产同步到 Gitee（自动更新备用 CDN 路线）
# 用法：bash scripts/sync-gitee.sh v0.2.1   （在 GitHub Actions 构建完成后运行）
# 前置：仓库 Secret 中配置 GITEE_TOKEN（Gitee 私人令牌，需 projects 权限）
# 产物：dist-updater/latest-cn.json（由 gen-latest.mjs 生成，须先运行）
set -uo pipefail

TAG="${1:?用法: sync-gitee.sh v0.2.1}"
OWNER="xfm0797"
REPO="x-note"
API="https://gitee.com/api/v5/repos/${OWNER}/${REPO}"
TOKEN="${GITEE_TOKEN:?缺少 GITEE_TOKEN 环境变量}"
AUTH="access_token=${TOKEN}"

EXE=$(ls src-tauri/target/release/bundle/nsis/*-setup.exe 2>/dev/null | head -1)
SIG="${EXE}.sig"
CN="dist-updater/latest-cn.json"
[ -f "$EXE" ] || { echo "未找到 NSIS 安装包"; exit 1; }
[ -f "$CN" ] || { echo "未找到 $CN（先运行 node scripts/gen-latest.mjs $TAG）"; exit 1; }

echo "==> 查询 Gitee 上是否已存在 $TAG 的 Release"
RELEASE_ID=$(curl -s "${API}/releases/tags/${TAG}?${AUTH}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.id||'')}catch{console.log('')}})")

if [ -z "${RELEASE_ID:-}" ]; then
  echo "==> 创建 Gitee Release $TAG（tag 已随仓库推送至 Gitee，不传 target_commitish）"
  VERSION="${TAG#v}"
  RESP=$(curl -s -X POST "${API}/releases?${AUTH}" \
    -H "Content-Type: application/json" \
    -d "{\"tag_name\":\"${TAG}\",\"name\":\"X-Note ${TAG}\",\"body\":\"X-Note ${VERSION} 更新。本页为国内直连备用下载路线，主发布页见 GitHub Release。\"}")
  echo "  API 响应: $RESP"
  RELEASE_ID=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.id||'')}catch{console.log('')}})")
  [ -n "$RELEASE_ID" ] || { echo "创建 Release 失败"; exit 1; }
fi
echo "Release ID: $RELEASE_ID"

echo "==> 上传安装包 / 签名 / 更新清单"
upload() { # $1=文件路径  $2=表单字段名
  curl -s -X POST "${API}/releases/${RELEASE_ID}/attach_files?${AUTH}" \
    -F "$2=@$1"
}
for f in "$EXE" "$SIG" "$CN"; do
  NAME=$(basename "$f")
  echo "  - $NAME"
  RESP=$(upload "$f" "files")
  if echo "$RESP" | grep -qi '"message"'; then
    echo "  字段名 files 失败，改用 files[] 重试：$RESP"
    RESP=$(upload "$f" "files[]")
    echo "$RESP" | grep -qi '"message"' && { echo "  上传失败: $NAME ($RESP)"; exit 1; }
  else
    echo "  OK"
  fi
done

echo "==> 校验 Release 资产"
curl -s "${API}/releases/${RELEASE_ID}?${AUTH}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);(j.assets||[]).forEach(a=>console.log('  *',a.name,a.size+'B'))})"

echo "==> 将 latest-cn.json 提交到 main（Gitee raw 端点使用）"
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add "$CN"
if git diff --cached --quiet; then
  echo "  无变更，跳过提交"
else
  git commit -m "chore(release): 更新 latest-cn.json 至 ${TAG}"
  # 推送到 Gitee main（备用端点读取的文件）与 GitHub main（保持双端同步）
  git remote remove gitee-mirror 2>/dev/null || true
  git remote add gitee-mirror "https://${OWNER}:${TOKEN}@gitee.com/${OWNER}/${REPO}.git"
  git push gitee-mirror HEAD:main || { echo "推送 Gitee main 失败"; exit 1; }
  git push origin HEAD:main || { echo "推送 GitHub main 失败"; exit 1; }
fi

echo "==> Gitee 同步完成：https://gitee.com/${OWNER}/${REPO}/releases/tag/${TAG}"
