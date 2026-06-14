#!/bin/bash
# Material Map Generator - 一键构建发布脚本

set -e

echo "=== Material Map Generator 自动化脚本 ==="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查依赖
check_deps() {
    echo -e "${YELLOW}检查依赖...${NC}"
    command -v node >/dev/null 2>&1 || { echo -e "${RED}需要 Node.js${NC}"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo -e "${RED}需要 npm${NC}"; exit 1; }
    echo -e "${GREEN}依赖检查通过${NC}"
}

# 安装依赖
install() {
    echo -e "\n${YELLOW}安装依赖...${NC}"
    npm install
    echo -e "${GREEN}依赖安装完成${NC}"
}

# 类型检查
check() {
    echo -e "\n${YELLOW}类型检查...${NC}"
    npm run check
    echo -e "${GREEN}类型检查通过${NC}"
}

# 构建
build() {
    echo -e "\n${YELLOW}构建生产版本...${NC}"
    npm run build
    echo -e "${GREEN}构建完成${NC}"
}

# 发布 Release
release() {
    VERSION=${1:-"v0.4.0"}
    TAG_MSG=${2:-"自动发布"}

    echo -e "\n${YELLOW}创建 Release: $VERSION${NC}"

    # 构建产物打包
    cd dist
    zip -r dist.zip .
    cd ..

    # 创建 GitHub Release
    RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"tag_name\": \"$VERSION\",
            \"name\": \"$VERSION - $TAG_MSG\",
            \"body\": \"自动构建发布\",
            \"draft\": false,
            \"prerelease\": false
        }" \
        https://api.github.com/repos/qwerrrtttyyy/mapgen/releases)

    RELEASE_ID=$(echo $RESPONSE | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')

    if [ -n "$RELEASE_ID" ]; then
        # 上传构建产物
        curl -s -X POST \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Content-Type: application/zip" \
            --data-binary @dist/dist.zip \
            "https://uploads.github.com/repos/qwerrrtttyyy/mapgen/releases/$RELEASE_ID/assets?name=dist.zip"

        echo -e "${GREEN}Release 创建成功: https://github.com/qwerrrtttyyy/mapgen/releases/tag/$VERSION${NC}"
    else
        echo -e "${RED}Release 创建失败${NC}"
        echo $RESPONSE
    fi
}

# 推送代码
push() {
    echo -e "\n${YELLOW}推送代码到 GitHub...${NC}"
    git add -A
    git commit -m "chore: 自动构建发布 $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main --force
    echo -e "${GREEN}推送成功${NC}"
}

# 完整流程
full() {
    check_deps
    install
    check
    build
    read -p "是否推送到 GitHub? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        push
    fi
    read -p "是否创建 Release? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        VERSION=${1:-"v0.4.0"}
        release $VERSION "自动构建"
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
    echo "  release 版本号    创建 Release"
    echo "  help              显示帮助"
    echo ""
    echo "示例:"
    echo "  ./scripts/release.sh full v0.4.0"
    echo "  ./scripts/release.sh build"
    echo "  ./scripts/release.sh release v0.4.1"
}

# 主逻辑
case "${1:-help}" in
    full)
        full ${2}
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
            echo -e "${RED}请指定版本号${NC}"
            show_help
            exit 1
        fi
        release $2 ${3:-"自动构建"}
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        show_help
        exit 1
        ;;
esac
