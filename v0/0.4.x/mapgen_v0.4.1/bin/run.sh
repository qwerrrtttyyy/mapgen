#!/usr/bin/env bash
# ==========================================================
#  Material Map Generator  —  One-click start script
#  v0.4.1  |  C/S Architecture
# ==========================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC}  $1"; }

# ── Banner ──
echo ""
echo "  +---------------------------------------------+"
echo "  |  Material Map Generator  v0.4.1              |"
echo "  |  One-Click Launcher                          |"
echo "  +---------------------------------------------+"
echo ""

# ── 1. Check Node.js ──
info "检查 Node.js..."

if command -v node &>/dev/null; then
  NODE_VER=$(node -v 2>/dev/null | sed 's/v//')
  MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  ok "Node.js ${NODE_VER} 已安装"
  if [ "$MAJOR" -lt 16 ]; then
    err "需要 Node.js >= 16，当前版本: ${NODE_VER}"
    echo "  请升级: https://nodejs.org"
    exit 1
  fi
else
  warn "Node.js 未安装"
  if command -v nvm &>/dev/null || [ -f "$HOME/.nvm/nvm.sh" ]; then
    info "通过 nvm 安装 Node.js..."
    [ -f "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"
    nvm install 20 || nvm install 18 || nvm install 16
    nvm use 20
  elif command -v fnm &>/dev/null; then
    info "通过 fnm 安装 Node.js..."
    fnm install 20
    fnm use 20
  else
    err "请先安装 Node.js >= 16"
    echo "  推荐: https://nodejs.org 或 nvm (https://github.com/nvm-sh/nvm)"
    exit 1
  fi
  ok "Node.js $(node -v) 已安装"
fi

# ── 2. Check npm (for v0.4.0 compat) ──
info "检查 npm..."
if command -v npm &>/dev/null; then
  ok "npm $(npm -v) 就绪"
else
  warn "npm 未安装（不影响 v0.4.1，仅 v0.4.0 需要）"
fi

# ── 3. Fix script permissions ──
info "修正脚本权限..."
chmod +x "$SCRIPT_DIR/bin/"*.sh "$SCRIPT_DIR/bin/"*.ps1 2>/dev/null || true
ok "权限已修正"

# ── 4. Check port availability ──
PORT=${MAPGEN_PORT:-8765}
info "检查端口 ${PORT}..."
if command -v ss &>/dev/null; then
  if ss -tlnp | grep -q ":${PORT} "; then
    warn "端口 ${PORT} 被占用，将自动回退"
  else
    ok "端口 ${PORT} 可用"
  fi
elif command -v lsof &>/dev/null; then
  if lsof -i :${PORT} &>/dev/null; then
    warn "端口 ${PORT} 被占用，将自动回退"
  else
    ok "端口 ${PORT} 可用"
  fi
fi

# ── 5. Check OS dependencies ──
info "检查系统依赖..."
case "$(uname -s)" in
  Linux*)
    if command -v xdg-open &>/dev/null; then
      ok "xdg-utils 就绪"
    else
      warn "xdg-utils 未安装，无法自动打开浏览器"
      echo "   安装: sudo apt install xdg-utils (Debian/Ubuntu)"
      echo "          sudo pacman -S xdg-utils (Arch)"
    fi
    ;;
  Darwin*) ok "macOS 就绪" ;;
  CYGWIN*|MINGW*|MSYS*) ok "Windows 环境" ;;
esac

# ── 6. Start server ──
echo ""
info "启动服务器..."
echo ""

# Check if node --watch is available (Node 18+)
if node -e "process.exit(+(process.version.slice(1).split('.')[0]>=18))" 2>/dev/null; then
  NODE_ARGS="--watch"
else
  NODE_ARGS=""
fi

trap 'echo ""; echo "已停止。"; exit 0' INT TERM

exec node $NODE_ARGS "$SCRIPT_DIR/server.js"
