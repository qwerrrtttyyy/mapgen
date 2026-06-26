#!/bin/bash
# Termux 环境配置脚本
# 使用方式: bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/termux.sh)

set -e

echo "=== Termux 环境配置 ==="
echo ""

# 检查是否在 Termux 中运行
if [ ! -d "/data/data/com.termux/files/usr" ] && [ -z "$TERMUX_VERSION" ]; then
    echo "警告: 未检测到 Termux 环境"
    echo "此脚本应在 Termux 中运行"
    echo "下载: https://f-droid.org/en/packages/com.termux/"
fi

# 更新包列表
echo "[1/5] 更新包列表..."
pkg update -y

# 安装 Node.js
echo "[2/5] 安装 Node.js..."
pkg install nodejs -y

# 安装 Git
echo "[3/5] 安装 Git..."
pkg install git -y

# 克隆仓库
echo "[4/5] 克隆仓库..."
cd "${HOME}"
rm -rf mapgen
git clone https://github.com/qwerrrtttyyy/mapgen.git
cd mapgen

# 安装项目依赖
echo "[5/5] 安装项目依赖..."
npm install

echo ""
echo "=========================================="
echo "  配置完成!"
echo ""
echo "  使用方法:"
echo "    cd ~/mapgen"
echo "    npm run dev    # 启动开发服务器"
echo "    npm run build  # 构建生产版本"
echo ""
echo "  浏览器访问: http://localhost:5173"
echo "=========================================="
