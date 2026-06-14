#!/bin/bash
# Termux 环境配置脚本
# 使用方式: bash <(curl -sL https://raw.githubusercontent.com/qwerrrtttyyy/mapgen/main/scripts/termux.sh)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Termux 环境配置 ===${NC}"

# 检查是否在 Termux 中运行
if [ ! -d "/data/data/com.termux/files/usr" ]; then
    echo -e "${RED}警告: 未检测到 Termux 环境${NC}"
    echo "此脚本应在 Termux 中运行"
fi

# 更新包列表
echo -e "\n${YELLOW}[1/5] 更新包列表...${NC}"
pkg update -y

# 安装 Node.js
echo -e "\n${YELLOW}[2/5] 安装 Node.js...${NC}"
pkg install nodejs -y

# 安装 Git
echo -e "\n${YELLOW}[3/5] 安装 Git...${NC}"
pkg install git -y

# 安装可选依赖
echo -e "\n${YELLOW}[4/5] 安装可选依赖...${NC}"
pkg install python make g++ -y

# 克隆仓库
echo -e "\n${YELLOW}[5/5] 克隆仓库...${NC}"
cd ~/ && rm -rf mapgen
git clone https://github.com/qwerrrtttyyy/mapgen.git
cd mapgen

# 安装项目依赖
echo -e "\n${YELLOW}安装项目依赖...${NC}"
npm install

echo -e "\n${GREEN}=== 配置完成! ===${NC}"
echo ""
echo "下一步:"
echo "  cd ~/mapgen"
echo "  npm run dev    # 启动开发服务器"
echo "  npm run build  # 构建生产版本"
