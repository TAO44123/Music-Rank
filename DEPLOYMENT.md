# 部署手册

从零搭一台服务器、日常重新部署、按环境打包、重启与验证。

数据库结构迁移、Seed、榜单导入与发布**不在本文件**,见 [docs/DATABASE_MIGRATION.md](docs/DATABASE_MIGRATION.md)。
配置键、优先级与耦合规则见 [docs/CONFIGURATION.md](docs/CONFIGURATION.md)。本文件只在需要时引用它们,不重复内容。

## 1. 部署形态

**生产形态下只有一个 Node 进程。** `NODE_ENV=production` 时 Express 同时提供 API 和 `apps/web/dist` 的前端静态文件,非 API 路径回退到 `index.html`(见 `apps/api/src/index.ts`)。没有独立的前端服务。

```
浏览器 → Nginx :80 → Express :3001 ─┬→ /api/*        REST API
                                     └→ 其余路径      前端静态文件
                                        ↓
                                  PostgreSQL :5432(同机,仅监听 localhost)
```

**同源是设计前提**,不是巧合:CSRF origin guard 与会话 cookie 的作用域都建立在前后端同源上。不要把前端拆到另一个域,那需要重新设计认证。

只有 PostgreSQL 在本地开发时跑 Docker;服务器上它是系统服务,应用与前端都直接跑 Node。

## 2. 首次部署

以 Amazon Linux 2023 为例,root 身份执行。

### 2.1 系统准备

```bash
useradd --system --create-home --home-dir /opt/music-rank --shell /sbin/nologin music-rank
```

**Node 必须 ≥ 22.9。** `npm run start:prod` 使用 `--env-file`(Node ≥20.6)和 `--env-file-if-exists`(Node ≥22.9);版本不够会报 `node: bad option`。AL2023 仓库自带的 `nodejs` 是 v18,**不能用**:

```bash
curl -fsSL https://rpm.nodesource.com/setup_24.x | bash - && dnf install -y nodejs && node -v
```

PostgreSQL 的安装见 [docs/DATABASE_MIGRATION.md](docs/DATABASE_MIGRATION.md)。装完建库建用户:

```bash
DB_PASS=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
sudo -u postgres psql -c "CREATE USER music_rank WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE music_rank OWNER music_rank;"
```

`OWNER music_rank` 是必须的——迁移第一步是 `CREATE SCHEMA IF NOT EXISTS "drizzle"`,不是属主会权限不足。

**RHEL 系的 `pg_hba.conf` 默认对本机 TCP 用 `ident` 认证**,密码认证走不通。把 `127.0.0.1/32` 与 `::1/128` 两行改成 `scram-sha-256`,不要动 `local ... peer`(那是 `sudo -u postgres psql` 的通路):

```bash
cp /var/lib/pgsql/data/pg_hba.conf /var/lib/pgsql/data/pg_hba.conf.bak
sed -i -E 's#^(host[[:space:]]+all[[:space:]]+all[[:space:]]+(127\.0\.0\.1/32|::1/128)[[:space:]]+)ident#\1scram-sha-256#' /var/lib/pgsql/data/pg_hba.conf
sudo -u postgres psql -c "SELECT pg_reload_conf();"
```

### 2.2 取代码

仓库是公开的,走 HTTPS,**部署机上不需要也不应该放能 push 的 SSH key**:

```bash
git clone https://github.com/TAO44123/Music-Rank.git /opt/music-rank/app
```

### 2.3 写机密配置

已跟踪的 `config/.env.production` **不含** `DATABASE_URL`。把它和正确的 `APP_ORIGIN` 写进未跟踪的 `.local`。下面这条让密码不经过屏幕和 shell history:

```bash
printf 'DATABASE_URL=postgresql://music_rank:%s@localhost:5432/music_rank\nAPP_ORIGIN=https://your-domain.example\n' "$DB_PASS" > /opt/music-rank/app/config/.env.production.local
unset DB_PASS
chmod 600 /opt/music-rank/app/config/.env.production.local
```

**`APP_ORIGIN` 必须逐字符等于浏览器地址栏的 origin**——协议、主机、端口都参与比对,结尾不能有斜杠。不一致时页面能打开、浏览正常,但所有写操作返回 403。这是上线后最常见的误判。

密码忘了不要紧,随时能从该文件读回:

```bash
sed -n 's#^DATABASE_URL=postgresql://music_rank:\([^@]*\)@.*#\1#p' /opt/music-rank/app/config/.env.production.local
```

### 2.4 装依赖、构建、初始化数据库

**`npm ci` 不能加 `--omit=dev`**:`typescript`(构建)和 `tsx`(迁移、Seed、榜单导入)都在 devDependencies 里。

```bash
cd /opt/music-rank/app && npm ci && npm run build
```

数据库初始化与榜单导入见 [docs/DATABASE_MIGRATION.md](docs/DATABASE_MIGRATION.md) 第 5 节。**每条数据库命令都要显式带 `APP_ENV=production`**,缺省是 `development`,会去连开发配置里的库。

### 2.5 systemd

```bash
cat > /etc/systemd/system/music-rank.service <<'EOF'
[Unit]
Description=Music Rank
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=music-rank
Group=music-rank
WorkingDirectory=/opt/music-rank/app
Environment=HOME=/opt/music-rank
ExecStart=/usr/bin/npm run start:prod
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
chown -R music-rank:music-rank /opt/music-rank
systemctl daemon-reload && systemctl enable --now music-rank
```

`Environment=HOME=/opt/music-rank` 不能省:npm 需要一个可写的 HOME,否则以 `music-rank` 身份启动会 EACCES。

### 2.6 Nginx

Express 已经同时服务 API 和静态文件,所以 Nginx 是纯反向代理,不需要拆 `location`。

给出完整的 `/etc/nginx/nginx.conf` 而不是往 `conf.d/` 丢片段,是为了避开一个常见坑:发行版自带的 `nginx.conf` 里有一个 `listen 80 default_server` 的欢迎页,它会截走所有没匹配到 `server_name` 的请求,表现是"配置明明写了却还是看到 Nginx 默认页"。

```bash
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
cat > /etc/nginx/nginx.conf <<'EOF'
user  nginx;
worker_processes auto;
error_log  /var/log/nginx/error.log notice;
pid        /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    sendfile        on;
    tcp_nopush      on;
    keepalive_timeout 65;
    server_tokens   off;

    gzip on;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        client_max_body_size 1m;

        location / {
            proxy_pass http://127.0.0.1:3001;
            proxy_http_version 1.1;

            proxy_set_header Host              $host;
            proxy_set_header X-Real-IP         $remote_addr;
            proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            proxy_connect_timeout 5s;
            proxy_send_timeout    60s;
            proxy_read_timeout    60s;
        }
    }
}
EOF
nginx -t && systemctl enable nginx && systemctl restart nginx
```

`Origin` 与 `Sec-Fetch-Site` 不用写 `proxy_set_header`,Nginx 默认透传所有客户端请求头(例外是**名字里带下划线**的头,本项目没有用到)。

### 2.7 放行端口

云平台的安全组/防火墙放行入站 TCP **80**(以及将来的 **443**)。

主机本身不需要额外的防火墙:安全组运行在实例之外的网络层,比主机防火墙更可靠,而本机暴露面已经很小(PostgreSQL 只监听 localhost,应用只监听 3001 且只有 Nginx 能访问)。

## 3. 日常重新部署

```bash
systemctl stop music-rank
cd /opt/music-rank/app
sudo -u music-rank git pull
npm ci && npm run build
APP_ENV=production npm run db:migrate
chown -R music-rank:music-rank /opt/music-rank
systemctl start music-rank
```

三条容易出错的地方:

- **`git pull` 必须以 `music-rank` 身份跑。** 用 root 跑会往 `.git` 里混入 root 属主的对象文件,下次以服务用户 pull 就会失败。
- **`npm ci` / `npm run build` 用 root 跑,完事统一 `chown`。** 服务用户的 shell 是 `nologin`,让它跑 npm 要额外绕 shell 和设 HOME,不如事后交属主省事。
- **迁移带 `APP_ENV=production`。** 没有新迁移时它是空操作,跑一遍无副作用;漏了则可能打到错误的库。

榜单数据有更新时,在 `npm run build` 之后按 [docs/DATABASE_MIGRATION.md](docs/DATABASE_MIGRATION.md) 第 5 节导入与发布。

## 4. 按环境打包与启动

| 命令 | 作用 |
| --- | --- |
| `npm run build` | 全部 workspace,web 用 `--mode production` |
| `npm run build:staging` | 同上,web 改用 `--mode staging` |
| `npm run start:prod` | 以 production 配置启动已构建的 API |
| `npm run start:staging` | 以 staging 配置启动已构建的 API |

启动命令形如:

```
node --env-file=config/.env.production --env-file-if-exists=config/.env.production.local apps/api/dist/index.js
```

`--env-file` 在前、`--env-file-if-exists` 在后,**顺序不可颠倒**:后者覆盖前者,`.local` 才能盖住 base。用 `-if-exists` 是因为 `.local` 本就可选,而普通 `--env-file` 遇到缺失文件会直接报错退出。

`--env-file` 在这里只有一个职责:跨平台注入 `APP_ENV`。npm script 里不含任何 shell 特有语法,bash、zsh、PowerShell、cmd.exe 行为一致。

**前端的环境是在构建时定死的**,不是运行时读的。改了 `VITE_*` 必须重新 `npm run build`,重启服务没有用。

## 5. 验证

仓库自带 [scripts/verify-deployment.sh](scripts/verify-deployment.sh),在部署机本机跑完整验收,不依赖外网可达性:

```bash
sudo /opt/music-rank/app/scripts/verify-deployment.sh
```

顺便核对 `APP_ORIGIN` 是否为预期值:

```bash
sudo /opt/music-rank/app/scripts/verify-deployment.sh https://your-domain.example
```

它检查三个服务、两个监听端口、经 Nginx 的应用可达性(loopback / 私网 IP / 域名 Host 头三条路径)、前端与 SPA 回退、榜单数据、origin guard 的两侧行为、本机防火墙。有失败项时退出码为 1,可用来卡部署流程。

**外网可达性单列在汇总之外**,因为它取决于安全组而非服务本身。设计意图是:安全组没开时本脚本仍应全绿——这样才能把"防火墙没开"和"应用坏了"区分开。

区分两种外网失败:**连接超时(timeout)= 安全组丢包;连接被拒(refused)= 服务没在监听。**

## 6. 回滚

代码回滚到上一个提交并重建:

```bash
cd /opt/music-rank/app
sudo -u music-rank git log --oneline -5
sudo -u music-rank git checkout <上一个提交>
npm ci && npm run build
chown -R music-rank:music-rank /opt/music-rank
systemctl restart music-rank
```

**数据库迁移不会自动回滚。** 如果那次部署包含结构迁移,先确认旧代码能在新 schema 上运行;不能的话需要人工处理,见 [docs/DATABASE_MIGRATION.md](docs/DATABASE_MIGRATION.md)。

## 7. 故障排查

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| `node: bad option: --env-file` | Node < 22.9,通常是装了发行版自带的 v18 | 用 NodeSource 装 Node 24 |
| 启动即退出,报 `DATABASE_URL: Invalid input` | `.local` 缺失,**或服务用户读不到它** | 先查 `.local` 的属主与权限,再查内容 |
| 所有写操作 403 `INVALID_ORIGIN` | `APP_ORIGIN` 与浏览器 origin 不一致 | 两者改成逐字符相同 |
| `psql` 报 `Ident authentication failed` | `pg_hba.conf` 默认对本机 TCP 用 `ident` | 改 `scram-sha-256` 并 `pg_reload_conf()` |
| Nginx 起不来,`Address already in use` | 有手工启动的游离 nginx 占着 80 | `ss -lntp \| grep :80` 找到 master pid,`kill -QUIT <pid>` |
| 外网 timeout,本机 curl 正常 | 安全组没放行 80 | 云平台加入站规则 |
| 外网 refused | 服务没监听或 Nginx 没跑 | `systemctl status nginx music-rank` |
| 构建报找不到 `tsc` | 用了 `npm ci --omit=dev` | 去掉该参数重装 |
| 服务器上 `db:migrate` 打到了开发库 | `APP_ENV` 缺省 `development` | 每条数据库命令都加 `APP_ENV=production` |
| 改了前端配置但页面没变 | 前端环境在构建时定死 | 重新 `npm run build`,重启无效 |

**配置类报错有一个陷阱:** `packages/config` 里的 `readEnvFile` 会吞掉所有读取异常(为了让可选的 `.local` 缺失时不报错),因此**权限不足读不到 `.local`,和文件根本不存在,表现完全一样**——都变成"缺 `DATABASE_URL`"。排查这类报错时先看文件属主,别在缺失上绕。

**在脚本或长命令里用 `mv` 要加反斜杠:** root 的 `mv` 通常是 `mv -i` 别名,交互确认会从粘贴的后续内容里读走一个字符当作回答,导致命令静默失败且不打印任何错误。用 `\mv` 或 `command mv` 绕开。

## 8. 待办

- **`app.set('trust proxy', ...)` 尚未启用。** 在 Nginx 后面,Express 看到的每个请求都来自 `127.0.0.1`,而登录限流按 `ip|username` 计数,按 IP 的那一半因此失效。Nginx 侧的 `X-Forwarded-For` 已经在传,缺的是应用侧的配置。
- **尚未启用 HTTPS。** 明文 HTTP 下会话 cookie 没有 `Secure` 标记。`APP_ORIGIN` 改成 `https://` 后,代码会自动切换到 `__Host-` 前缀的安全 cookie(见 `apps/api/src/app.ts` 的 `getCookieConfiguration`),这部分无需改代码。
