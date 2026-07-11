#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_NC='\033[0m'

print_header() {
  echo -e "${COLOR_BLUE}========================================${COLOR_NC}"
  echo -e "${COLOR_BLUE}  $1${COLOR_NC}"
  echo -e "${COLOR_BLUE}========================================${COLOR_NC}"
}

print_success() {
  echo -e "${COLOR_GREEN}✅ $1${COLOR_NC}"
}

print_warning() {
  echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_NC}"
}

print_error() {
  echo -e "${COLOR_RED}❌ $1${COLOR_NC}"
}

show_help() {
  cat <<EOF
MapGen 自动化测试套件

用法:
  $(basename "$0") [命令] [选项]

命令:
  all           运行所有测试（默认）
  unit          仅运行单元测试（core + shared-types）
  integration   运行集成测试（manager + server）
  web           运行前端测试
  perf          运行性能基准测试
  coverage      运行测试并生成覆盖率报告
  watch         监听模式运行测试
  fast          快速测试（遇错即停）
  stress        压力测试（多次运行验证稳定性）
  ci            CI 模式（带覆盖率 + JUnit 报告）

选项:
  -h, --help    显示帮助
  -v, --verbose 详细输出
  --bail        遇错即停
  --timeout=N   设置超时时间（毫秒）

示例:
  $(basename "$0") unit
  $(basename "$0") coverage
  $(basename "$0") perf
  $(basename "$0") stress --times=10
EOF
}

run_unit_tests() {
  print_header "运行单元测试"
  bun test packages/shared/src/__tests__/*.test.ts packages/shared-types/src/__tests__/*.test.ts
  print_success "单元测试完成"
}

run_integration_tests() {
  print_header "运行集成测试"
  bun test packages/manager/src/__tests__/*.test.ts
  print_success "集成测试完成"
}

run_web_tests() {
  print_header "运行前端测试"
  bun test packages/web/src/__tests__/*.test.ts
  print_success "前端测试完成"
}

run_perf_tests() {
  print_header "运行性能基准测试"
  bun test packages/shared/src/__tests__/performance.test.ts
  print_success "性能测试完成"
}

run_coverage() {
  print_header "运行测试并生成覆盖率报告"
  bun test --coverage --coverage-reporter=text --coverage-reporter=lcov --coverage-dir=coverage packages/*/src/__tests__/*.test.ts
  echo ""
  print_success "覆盖率报告已生成到 coverage/"
}

run_watch() {
  print_header "监听模式"
  bun test --watch packages/*/src/__tests__/*.test.ts
}

run_fast() {
  print_header "快速测试模式"
  bun test --bail packages/*/src/__tests__/*.test.ts
}

run_stress() {
  local times="${1:-5}"
  print_header "压力测试（运行 ${times} 次）"
  local failed=0
  for i in $(seq 1 "$times"); do
    echo ""
    echo "--- 第 $i/$times 次运行 ---"
    if ! bun test packages/shared/src/__tests__/noise.test.ts packages/shared/src/__tests__/cache.test.ts > /dev/null 2>&1; then
      print_error "第 $i 次运行失败"
      failed=$((failed + 1))
    else
      print_success "第 $i 次运行通过"
    fi
  done
  echo ""
  if [ "$failed" -eq 0 ]; then
    print_success "压力测试全部通过 ($times/$times)"
  else
    print_error "压力测试失败 ($failed/$times 失败)"
    exit 1
  fi
}

run_ci() {
  print_header "CI 模式测试"
  bun test \
    --coverage \
    --coverage-reporter=text \
    --coverage-reporter=lcov \
    --coverage-dir=coverage \
    --reporter=junit \
    --reporter-outfile=coverage/test-results.xml \
    packages/*/src/__tests__/*.test.ts
  print_success "CI 测试完成"
}

run_all() {
  print_header "运行全部测试"
  bun test packages/*/src/__tests__/*.test.ts
  print_success "全部测试完成"
}

main() {
  local cmd="all"
  local stress_times=5

  for arg in "$@"; do
    case "$arg" in
      -h|--help)
        show_help
        exit 0
        ;;
      all|unit|integration|web|perf|coverage|watch|fast|stress|ci)
        cmd="$arg"
        ;;
      --times=*)
        stress_times="${arg#*=}"
        ;;
      *)
        print_error "未知命令: $arg"
        show_help
        exit 1
        ;;
    esac
  done

  case "$cmd" in
    all) run_all ;;
    unit) run_unit_tests ;;
    integration) run_integration_tests ;;
    web) run_web_tests ;;
    perf) run_perf_tests ;;
    coverage) run_coverage ;;
    watch) run_watch ;;
    fast) run_fast ;;
    stress) run_stress "$stress_times" ;;
    ci) run_ci ;;
  esac
}

main "$@"
