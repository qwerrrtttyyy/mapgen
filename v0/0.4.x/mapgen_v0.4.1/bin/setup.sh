#!/usr/bin/env bash
# ==========================================================
#  Material Map Generator  —  Dependency Setup & Fix
#  v0.4.1
# ==========================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERR]${NC}  $1"; }

echo ""
echo "  +---------------------------------------------+"
echo "  |  Material Map Generator  v0.4.1              |"
echo "  |  Dependency Setup & Fix                      |"
echo "  +---------------------------------------------+"
echo ""

FIXED=0

# ── 1. Node.js version ──
info "检查 Node.js 版本..."
if command -v node &>/dev/null; then
  NODE_VER=$(node -v 2>/dev/null | sed 's/v//')
  MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$MAJOR" -ge 16 ]; then
    ok "Node.js ${NODE_VER} ✓"
  else
    err "版本过低: ${NODE_VER} (需要 >= 16)"
    warn "请升级: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    FIXED=1
  fi
else
  err "Node.js 未安装"
  warn "安装: https://nodejs.org 或使用 nvm"
  FIXED=1
fi

# ── 2. npm ──
info "检查 npm..."
if command -v npm &>/dev/null; then
  ok "npm $(npm -v) ✓"
else
  warn "npm 未安装（不影响 v0.4.1）"
fi

# ── 3. Project structure ──
info "检查项目结构..."
MISSING=0
for f in server.js public/index.html public/js/app.js public/style.css; do
  [ -f "$f" ] || { warn "缺少: $f"; MISSING=1; FIXED=1; }
done
[ "$MISSING" -eq 0 ] && ok "项目结构完整 ✓"

# ── 4. Script permissions ──
info "检查脚本权限..."
for f in bin/*.sh; do
  [ -x "$f" ] || { chmod +x "$f"; ok "已修复权限: $f"; FIXED=1; }
done
[ -x "bin/start.sh" ] && ok "脚本权限正确 ✓"

# ── 5. Checkpoint directory ──
info "检查检查点目录..."
if [ ! -d ".checkpoints" ]; then
  mkdir -p .checkpoints
  ok "已创建 .checkpoints/ 目录"
  FIXED=1
else
  ok "检查点目录存在 ✓"
fi

# ── 6. Config file ──
info "检查配置文件..."
if [ ! -f "mapgen.json" ]; then
  cat > mapgen.json << 'EOF'
{
  "port": 8765,
  "host": "127.0.0.1",
  "openBrowser": true,
  "autoPortFallback": true,
  "ckptDir": ".checkpoints"
}
EOF
  ok "已创建 mapgen.json 配置文件"
  FIXED=1
else
  ok "配置文件存在 ✓"
fi

# ── 7. OS dependencies ──
info "检查系统依赖..."
case "$(uname -s)" in
  Linux*)
    if command -v xdg-open &>/dev/null; then
      ok "xdg-utils 就绪 ✓"
    else
      warn "xdg-utils 未安装（自动打开浏览器需要）"
      warn "  安装: sudo apt install xdg-utils || sudo pacman -S xdg-utils"
    fi
    ;;
esac

# ── 8. Disk space ──
info "检查磁盘空间..."
AVAIL=$(df -k . | tail -1 | awk '{print $4}')
if [ "$AVAIL" -lt 102400 ]; then
  warn "磁盘空间不足: ${AVAIL}KB（至少需要 100MB）"
else
  ok "磁盘空间充足 ✓"
fi

# ── 9. Port availability ──
info "检查默认端口..."
PORT=${MAPGEN_PORT:-8765}
if command -v ss &>/dev/null; then
  if ss -tlnp | grep -q ":${PORT} "; then
    warn "端口 ${PORT} 被占用（将自动回退）"
  else
    ok "端口 ${PORT} 可用 ✓"
  fi
elif command -v lsof &>/dev/null; then
  if lsof -i :${PORT} &>/dev/null; then
    warn "端口 ${PORT} 被占用（将自动回退）"
  else
    ok "端口 ${PORT} 可用 ✓"
  fi
fi

# ── Summary ──
echo ""
if [ "$FIXED" -eq 0 ]; then
  echo -e "${GREEN}  ✓ 所有依赖检查通过，无需修复${NC}"
else
  echo -e "${YELLOW}  ⚠ 部分问题已修复，建议重新运行检查${NC}"
fi
echo ""
echo "  启动: ./bin/run.sh"
echo "  或:   node server.js"
echo ""
