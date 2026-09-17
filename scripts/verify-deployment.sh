#!/usr/bin/env bash
#
# 在部署机本机验收整套服务,不依赖外网可达性。
#
#   ./scripts/verify-deployment.sh
#   ./scripts/verify-deployment.sh https://mr.authright.com   # 顺便核对 APP_ORIGIN 是否为预期值
#
# 退出码 0 表示全部通过,1 表示有失败项,可直接用于自动化。
#
# 设计意图:安全组/DNS 未就绪时,本脚本仍应全绿——它验证的是"服务侧有没有做好准备",
# 把"外网通不通"单独列为提示项,避免把防火墙问题误判成应用问题。

set -uo pipefail

CONFIG_FILE="${CONFIG_FILE:-/opt/music-rank/app/config/.env.production.local}"
BASE="${BASE:-http://127.0.0.1}"
EXPECTED_ORIGIN="${1:-}"
CURL_TIMEOUT=5

pass_count=0
fail_count=0
warn_count=0

if [ -t 1 ]; then
  C_PASS=$'\033[32m'; C_FAIL=$'\033[31m'; C_WARN=$'\033[33m'; C_OFF=$'\033[0m'
else
  C_PASS=''; C_FAIL=''; C_WARN=''; C_OFF=''
fi

# 刻意不做列对齐:printf 的 %-Ns 按字节补空格,而中文一个字占 3 字节却只显示 2 列,
# 且破折号、省略号等是 3 字节宽度却为 1,在 bash 里算准东亚字宽不值得。
# PASS/FAIL 这一列是 ASCII,本身就对齐,扫视靠的就是它。
report() { # report <PASS|FAIL|WARN> <label> <detail>
  local status="$1" label="$2" detail="${3:-}" colour=''
  case "$status" in
    PASS) colour="$C_PASS"; pass_count=$((pass_count + 1)) ;;
    FAIL) colour="$C_FAIL"; fail_count=$((fail_count + 1)) ;;
    WARN) colour="$C_WARN"; warn_count=$((warn_count + 1)) ;;
  esac
  if [ -n "$detail" ]; then
    printf '%s%-4s%s %s: %s\n' "$colour" "$status" "$C_OFF" "$label" "$detail"
  else
    printf '%s%-4s%s %s\n' "$colour" "$status" "$C_OFF" "$label"
  fi
}

fetch() { # fetch <url> [extra curl args...] -> body
  curl -s -m "$CURL_TIMEOUT" "$@"
}

status_of() { # status_of <url> [extra curl args...] -> HTTP code
  curl -s -m "$CURL_TIMEOUT" -o /dev/null -w '%{http_code}' "$@"
}

# ---------------------------------------------------------------- 配置

if [ ! -r "$CONFIG_FILE" ]; then
  report FAIL "读取 $CONFIG_FILE" "不存在或无权读取"
  echo
  echo "提示: 以 root 运行,或用 CONFIG_FILE=... 指定路径。"
  exit 1
fi

app_origin=$(sed -n 's/^APP_ORIGIN=//p' "$CONFIG_FILE" | tail -1)
if [ -z "$app_origin" ]; then
  report FAIL "APP_ORIGIN" "未在配置中设置"
  exit 1
fi

# 从 APP_ORIGIN 里取主机名,用于 Host 头路由测试
origin_host=${app_origin#*://}
origin_host=${origin_host%%/*}
private_ip=$(hostname -I 2>/dev/null | awk '{print $1}')

echo "APP_ORIGIN = $app_origin"
echo "主机名     = $origin_host"
echo "私网 IP    = ${private_ip:-未知}"
echo "------------------------------------------------------------------"

if [ -n "$EXPECTED_ORIGIN" ]; then
  if [ "$app_origin" = "$EXPECTED_ORIGIN" ]; then
    report PASS "APP_ORIGIN 与预期一致" "$app_origin"
  else
    report FAIL "APP_ORIGIN 与预期不一致" "实际 $app_origin,预期 $EXPECTED_ORIGIN"
  fi
fi

# ---------------------------------------------------------------- 服务

for unit in postgresql music-rank nginx; do
  state=$(systemctl is-active "$unit" 2>/dev/null)
  if [ "$state" = "active" ]; then
    report PASS "服务 $unit" "$state"
  else
    report FAIL "服务 $unit" "${state:-未知}"
  fi
done

# ---------------------------------------------------------------- 端口

if ss -lnt 2>/dev/null | grep -q ':3001'; then
  report PASS "3001 监听" "应用进程"
else
  report FAIL "3001 监听" "无监听"
fi

if ss -lnt 2>/dev/null | grep -qE '0\.0\.0\.0:80|\*:80'; then
  report PASS "80 监听于所有网卡" "0.0.0.0:80"
elif ss -lnt 2>/dev/null | grep -q '127.0.0.1:80'; then
  report FAIL "80 监听于所有网卡" "只绑了 loopback,外部无法访问"
else
  report FAIL "80 监听于所有网卡" "无监听"
fi

# ---------------------------------------------------------------- 经 Nginx 的应用可达性

health=$(fetch "$BASE/api/health")
if [ "$health" = '{"status":"ok","database":"ok"}' ]; then
  report PASS "经 Nginx 健康检查" "$health"
else
  report FAIL "经 Nginx 健康检查" "${health:-无响应}"
fi

if [ -n "$private_ip" ]; then
  health_priv=$(fetch "http://$private_ip/api/health")
  if [ "$health_priv" = '{"status":"ok","database":"ok"}' ]; then
    report PASS "经私网 IP 健康检查" "$private_ip"
  else
    report FAIL "经私网 IP 健康检查" "${health_priv:-无响应}"
  fi
fi

# 这一项最关键:证明域名路由在本机就是通的,与 DNS 和防火墙无关
health_host=$(fetch "$BASE/api/health" -H "Host: $origin_host")
if [ "$health_host" = '{"status":"ok","database":"ok"}' ]; then
  report PASS "域名 Host 头路由" "$origin_host"
else
  report FAIL "域名 Host 头路由" "${health_host:-无响应}"
fi

# ---------------------------------------------------------------- 前端

if fetch "$BASE/" | grep -qi '<!doctype html'; then
  report PASS "前端 HTML" "已由 Express 提供"
else
  report FAIL "前端 HTML" "未返回 HTML(NODE_ENV 是 production 吗?)"
fi

if fetch "$BASE/some/deep/route" | grep -qi '<!doctype html'; then
  report PASS "SPA 路径回退" "非 API 路径回落到 index.html"
else
  report FAIL "SPA 路径回退" "未回落"
fi

rankings=$(fetch "$BASE/api/rankings")
case "$rankings" in
  '[{'*) report PASS "榜单数据" "$(printf '%s' "$rankings" | head -c 48)…" ;;
  '[]')  report WARN "榜单数据" "返回空数组,seed 跑过了吗?" ;;
  *)     report FAIL "榜单数据" "${rankings:-无响应}" ;;
esac

# ---------------------------------------------------------------- Origin 防护
# 用随机用户名,避免反复运行把限流计数打在真实账号上(限流键是 ip|username)

probe_user="verify_$RANDOM$RANDOM"
probe_body="{\"username\":\"$probe_user\",\"password\":\"wrongwrongwrong\"}"

code_ok=$(status_of -X POST "$BASE/api/auth/login" \
  -H "Origin: $app_origin" -H 'Content-Type: application/json' -d "$probe_body")
code_bad=$(status_of -X POST "$BASE/api/auth/login" \
  -H 'Origin: http://evil.example' -H 'Content-Type: application/json' -d "$probe_body")

if [ "$code_ok" = "403" ]; then
  report FAIL "正确 Origin 通过守卫" "403 — APP_ORIGIN 与实际访问地址不符"
elif [ "$code_ok" = "401" ] || [ "$code_ok" = "400" ]; then
  report PASS "正确 Origin 通过守卫" "$code_ok(守卫放行,凭据无效属预期)"
else
  report WARN "正确 Origin 通过守卫" "$code_ok(非预期状态码)"
fi

if [ "$code_bad" = "403" ]; then
  report PASS "异域 Origin 被拦截" "403"
else
  report FAIL "异域 Origin 被拦截" "$code_bad — CSRF 防护未生效"
fi

# ---------------------------------------------------------------- 本机防火墙
# 目的是把"安全组没开"和"机器本地还有一道墙"区分开

fw=$(systemctl is-active firewalld 2>/dev/null)
if [ "$fw" = "active" ]; then
  report WARN "firewalld" "运行中 — 即使安全组放行也需本机放行 80"
else
  report PASS "firewalld" "${fw:-未安装}"
fi

# 三种情况要分开说:没装(等于没有本机防火墙,通过)、装了但没权限看(无法判断)、
# 装了且看得到规则。合并成一条"未检查"会让人以为是权限问题而去纠结 sudo。
if ! command -v iptables >/dev/null 2>&1; then
  report PASS "iptables" "未安装,无本机防火墙"
elif [ "$(id -u)" -ne 0 ]; then
  report WARN "iptables 规则" "需 root 才能查看,本次未检查"
else
  rules=$(iptables -S 2>/dev/null | grep -c '^-A')
  if [ "${rules:-0}" -eq 0 ]; then
    report PASS "iptables 规则" "0 条"
  else
    report WARN "iptables 规则" "$rules 条 — 确认未拦截 80"
  fi
fi

# ---------------------------------------------------------------- 外网可达性(仅提示)

echo "------------------------------------------------------------------"
ext=$(status_of "$app_origin/api/health")
if [ "$ext" = "200" ]; then
  echo "外网可达: $app_origin 返回 200,安全组已放行。"
else
  echo "外网未通: $app_origin 无响应(curl 状态 $ext)。"
  echo "  若上面各项全绿,则问题在服务器之外——通常是 AWS 安全组未放行入站 TCP 80。"
  echo "  连接超时(timeout)= 安全组丢包;连接被拒(refused)= 服务未监听。"
fi

# ---------------------------------------------------------------- 汇总

echo "------------------------------------------------------------------"
printf '通过 %d  失败 %d  提示 %d\n' "$pass_count" "$fail_count" "$warn_count"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi
exit 0
