#!/bin/bash
# Material Map Generator - 极简一键脚本 (单行版)
# 使用方式: 
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) [命令]
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) install
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) build
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) release v0.4.0
#   bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/quick.sh) termux

set -e

CMD="${1:-help}"
GH_REPO="qwerrrtttyyy/mapgen"
GH_API="https://api.github.com/repos/$GH_REPO"
TOKEN="${GITHUB_TOKEN:-}"
PROJECT_DIR="${HOME}/mapgen"
SCRIPT_DIR="$(pwd)"

# ========== 工具函数 ==========

ensure_in_project() {
    # 如果当前目录有 package.json，认为是项目目录
    if [ -f "package.json" ]; then
        PROJECT_DIR="$(pwd)"
        return
    fi
    # 否则使用默认的 PROJECT_DIR
    if [ -f "${PROJECT_DIR}/package.json" ]; then
        cd "${PROJECT_DIR}"
        echo "已切换到: ${PROJECT_DIR}"
    else
        echo "警告: 未找到项目目录 (${PROJECT_DIR})"
        echo "请先运行: bash <(curl -sL ...) install"
        echo "或手动: cd /path/to/project"
        exit 1
    fi
}

check_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "错误: 缺少依赖 '$1'"
        return 1
    fi
    return 0
}

# ========== 命令实现 ==========

termux_setup() {
    echo "[Termux] 正在配置环境..."
    pkg update -y
    pkg install nodejs git -y

    echo "[Termux] 克隆仓库..."
    cd "${HOME}"
    rm -rf mapgen
    git clone "https://github.com/${GH_REPO}.git"
    cd mapgen

    echo "[Termux] 安装项目依赖..."
    npm install

    echo ""
    echo "=========================================="
    echo "  完成! 运行以下命令开始使用:"
    echo "    cd ~/mapgen"
    echo "    npm run dev"
    echo "=========================================="
}

install_deps() {
    echo "[1/3] 检查环境..."
    check_cmd node || (echo "请先安装 Node.js: https://nodejs.org" && exit 1)
    check_cmd npm || (echo "请先安装 npm" && exit 1)

    echo "[2/3] 检查项目目录..."
    if [ ! -f "package.json" ]; then
        echo "未找到 package.json，克隆仓库到 ${PROJECT_DIR}..."
        mkdir -p "${PROJECT_DIR}"
        cd "${PROJECT_DIR}"
        if [ ! -f "package.json" ]; then
            rm -rf ./*
            git clone "https://github.com/${GH_REPO}.git" .
        fi
    fi

    echo "[3/3] 安装依赖..."
    npm install
    echo "完成!"
    echo "项目目录: $(pwd)"
}

type_check() {
    ensure_in_project
    check_cmd npm || exit 1
    echo "类型检查..."
    npm run check
    echo "通过!"
}

build_prod() {
    ensure_in_project
    check_cmd npm || exit 1
    echo "构建生产版本..."
    npm run build
    echo "完成! 产物在: $(pwd)/dist/"
}

start_dev() {
    ensure_in_project
    check_cmd npm || exit 1
    echo "启动开发服务器 (http://localhost:5173)..."
    npm run dev
}

preview_prod() {
    ensure_in_project
    check_cmd npm || exit 1
    echo "预览生产版本 (http://localhost:4173)..."
    npm run preview
}

create_release() {
    local VERSION="${2:-$(date +v%y.%m.%d%H%M)}"
    local TAG_MSG="${3:-auto}"

    if [ -z "$TOKEN" ]; then
        echo "错误: 请先设置 GITHUB_TOKEN 环境变量"
        exit 1
    fi

    ensure_in_project
    check_cmd npm || exit 1
    check_cmd tar || exit 1

    echo "创建 Release: $VERSION"

    # 构建
    npm run build

    # 打包 (使用 tar，兼容性更好)
    local TEMP_DIR="$(mktemp -d)"
    local ORIG_DIR="$(pwd)"
    cd dist
    tar -czf "${TEMP_DIR}/dist.tar.gz" .
    cd "$ORIG_DIR"

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
            -H "Content-Type: application/gzip" \
            --data-binary @"${TEMP_DIR}/dist.tar.gz" \
            "https://uploads.github.com/repos/$GH_REPO/releases/$RELEASE_ID/assets?name=dist.tar.gz"

        rm -rf "$TEMP_DIR"
        echo ""
        echo "成功! https://github.com/$GH_REPO/releases/tag/$VERSION"
    else
        rm -rf "$TEMP_DIR"
        echo "失败: $RESPONSE"
    fi
}

clone_repo() {
    echo "克隆仓库到 ${PROJECT_DIR}..."
    mkdir -p "${PROJECT_DIR}"
    cd "${PROJECT_DIR}"
    if [ -d ".git" ]; then
        echo "已存在仓库，拉取最新代码..."
        git pull
    else
        echo "克隆仓库..."
        rm -rf ./*
        git clone "https://github.com/${GH_REPO}.git" .
    fi
    echo "完成! 目录: ${PROJECT_DIR}"
}

push_code() {
    ensure_in_project
    check_cmd git || exit 1
    echo "推送代码..."
    git add -A
    # 允许 commit 失败（无变更时）
    git commit -m "chore: $(date '+%Y-%m-%d %H:%M:%S')" || true
    git push origin main || true
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
    echo "  install          安装依赖（自动克隆仓库）"
    echo "  check            类型检查"
    echo "  build            构建生产版本"
    echo "  dev              启动开发服务器"
    echo "  preview          预览生产版本"
    echo "  release [版本]   创建 Release (需 GITHUB_TOKEN)"
    echo "  clone            克隆仓库"
    echo "  push             推送代码"
    echo "  releases         列出所有版本"
    echo "  termux           Termux 环境一键配置"
    echo "  help             显示帮助"
    echo ""
    echo "示例:"
    echo "  bash <(curl -sL ...) install"
    echo "  bash <(curl -sL ...) build"
    echo "  bash <(curl -sL ...) release v0.4.0"
    echo "  bash <(curl -sL ...) termux"
}

# ========== 主逻辑 ==========

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
    termux) termux_setup ;;
    help|--help|-h) show_help ;;
    *) show_help ;;
esac
