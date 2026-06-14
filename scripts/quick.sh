#!/bin/bash
# Material Map Generator - 极简一键脚本 (单行版)
# 使用方式: 
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) [命令]
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) install
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) build
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) release v0.4.0

set -e
CMD="${1:-help}"
GH_REPO="qwerrrtttyyy/mapgen"
GH_API="https://api.github.com/repos/$GH_REPO"
DESTDIR="${HOME}/.mapgen"
TOKEN="${GITHUB_TOKEN:-}"

install_deps() {
    echo "安装依赖..."
    npm install
    echo "完成!"
}

type_check() {
    echo "类型检查..."
    npm run check
    echo "通过!"
}

build_prod() {
    echo "构建生产版本..."
    npm run build
    echo "完成! 产物在 dist/"
}

start_dev() {
    echo "启动开发服务器..."
    npm run dev
}

preview_prod() {
    echo "预览生产版本..."
    npm run preview
}

gen_version() {
    echo "生成版本号..."
    date +v%y.%m.%d%H%M
}

create_release() {
    local VERSION="${2:-$(date +v%y.%m.%d%H%M)}"
    local TAG_MSG="${3:-auto}"
    
    echo "创建 Release: $VERSION"
    
    # 构建
    npm run build
    
    # 打包
    mkdir -p dist_temp
    cd dist_temp
    zip -r dist.zip ../dist .
    cd ..
    
    # 创建 Release
    local RESPONSE=$(curl -s -X POST \
        -H "Authorization: token $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"tag_name\":\"$VERSION\",\"name\":\"$VERSION\",\"body\":\"$TAG_MSG\"}" \
        "$GH_API/releases")
    
    local RELEASE_ID=$(echo "$RESPONSE" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
    
    if [ -n "$RELEASE_ID" ]; then
        curl -s -X POST \
            -H "Authorization: token $TOKEN" \
            -H "Content-Type: application/zip" \
            --data-binary @dist_temp/dist.zip \
            "https://uploads.github.com/repos/$GH_REPO/releases/$RELEASE_ID/assets?name=dist.zip"
        
        rm -rf dist_temp
        echo "成功! https://github.com/$GH_REPO/releases/tag/$VERSION"
    else
        echo "失败: $RESPONSE"
    fi
}

clone_repo() {
    echo "克隆仓库到 $DESTDIR..."
    mkdir -p "$DESTDIR"
    cd "$DESTDIR"
    if [ -d .git ]; then
        git pull
    else
        git clone "https://github.com/$GH_REPO.git" .
    fi
    echo "完成!"
}

push_code() {
    echo "推送代码..."
    git add -A
    git commit -m "chore: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main
    echo "完成!"
}

list_releases() {
    echo "所有 Releases:"
    curl -s "$GH_API/releases" | grep -o '"tag_name": "[^"]*"' | sed 's/.*: "//;s/"//'
}

show_help() {
    echo "Material Map Generator 一键脚本"
    echo ""
    echo "使用方法: bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) [命令]"
    echo ""
    echo "命令:"
    echo "  install          安装依赖"
    echo "  check            类型检查"
    echo "  build            构建生产版本"
    echo "  dev              启动开发服务器"
    echo "  preview          预览生产版本"
    echo "  release [版本]   创建 Release"
    echo "  clone            克隆仓库"
    echo "  push             推送代码"
    echo "  releases         列出所有版本"
    echo "  help             显示帮助"
    echo ""
    echo "示例:"
    echo "  bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) install"
    echo "  bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) build"
    echo "  bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) release v0.4.0"
}

case "$CMD" in
    install) install_deps ;;
    check) type_check ;;
    build) build_prod ;;
    dev) start_dev ;;
    preview) preview_prod ;;
    release) create_release "$@" ;;
    clone) clone_repo ;;
    push) push_code ;;
    releases) list_releases ;;
    help|--help|-h) show_help ;;
    *) show_help ;;
esac
