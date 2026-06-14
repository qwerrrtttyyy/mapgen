#!/bin/bash
# Material Map Generator - 一键构建发布脚本
# 使用方式: ./scripts/release.sh [命令] [参数]

set -e

GH_REPO="qwerrrtttyyy/mapgen"

echo "=== Material Map Generator 自动化脚本 ==="
echo ""

# 检查依赖
check_deps() {
    echo "检查依赖..."
    command -v node >/dev/null 2>&1 || { echo "错误: 需要 Node.js"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "错误: 需要 npm"; exit 1; }
    echo "通过!"
}

# 安装依赖
install() {
    echo "安装依赖..."
    npm install
    echo "完成!"
}

# 类型检查
check() {
    echo "类型检查..."
    npm run check
    echo "通过!"
}

# 构建
build() {
    echo "构建生产版本..."
    npm run build
    echo "完成!"
}

# 发布 Release
release() {
    VERSION="${1:-v0.4.0}"
    TAG_MSG="${2:-自动发布}"

    if [ -z "$GITHUB_TOKEN" ]; then
        echo "错误: 请设置 GITHUB_TOKEN 环境变量"
        exit 1
    fi

    echo "创建 Release: $VERSION"

    # 构建
    npm run build

    # 打包
    local TEMP_DIR="$(mktemp -d)"
    local ORIG_DIR="$(pwd)"
    cd dist
    tar -czf "${TEMP_DIR}/dist.tar.gz" .
    cd "$ORIG_DIR"

    # 创建 Release
    local RESPONSE=$(curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"tag_name\":\"$VERSION\",\"name\":\"$VERSION\",\"body\":\"$TAG_MSG\"}" \
        "https://api.github.com/repos/$GH_REPO/releases")

    local RELEASE_ID=$(echo "$RESPONSE" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')

    if [ -n "$RELEASE_ID" ]; then
        curl -s -X POST \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Content-Type: application/gzip" \
            --data-binary @"${TEMP_DIR}/dist.tar.gz" \
            "https://uploads.github.com/repos/$GH_REPO/releases/$RELEASE_ID/assets?name=dist.tar.gz"

        rm -rf "$TEMP_DIR"
        echo "成功! https://github.com/$GH_REPO/releases/tag/$VERSION"
    else
        rm -rf "$TEMP_DIR"
        echo "失败: $RESPONSE"
    fi
}

# 推送代码
push() {
    echo "推送代码到 GitHub..."
    git add -A
    git commit -m "chore: 自动构建发布 $(date '+%Y-%m-%d %H:%M:%S')" || true
    git push origin main || true
    echo "完成!"
}

# 完整流程
full() {
    check_deps
    install
    check
    build
    if [ -t 0 ]; then
        read -p "是否推送到 GitHub? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            push
        fi
        read -p "是否创建 Release? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            release "${1:-v0.4.0}" "自动构建"
        fi
    else
        echo "非交互模式，跳过推送和发布"
    fi
}

# 显示帮助
show_help() {
    echo "用法: ./scripts/release.sh [命令] [参数]"
    echo ""
    echo "命令:"
    echo "  full [版本号]     完整流程: 安装 → 检查 → 构建 → 推送 → 发布"
    echo "  install           安装依赖"
    echo "  check             类型检查"
    echo "  build             构建生产版本"
    echo "  push              推送到 GitHub"
    echo "  release 版本号    创建 Release (需 GITHUB_TOKEN)"
    echo "  help              显示帮助"
    echo ""
    echo "示例:"
    echo "  ./scripts/release.sh full v0.4.0"
    echo "  ./scripts/release.sh build"
    echo "  GITHUB_TOKEN=xxx ./scripts/release.sh release v0.4.1"
}

# 主逻辑
case "${1:-help}" in
    full)
        full "${2}"
        ;;
    install)
        check_deps
        install
        ;;
    check)
        check
        ;;
    build)
        check_deps
        build
        ;;
    push)
        push
        ;;
    release)
        if [ -z "$2" ]; then
            echo "请指定版本号"
            show_help
            exit 1
        fi
        release "$2" "${3:-自动构建}"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "未知命令: $1"
        show_help
        exit 1
        ;;
esac
