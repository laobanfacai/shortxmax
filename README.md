# ShortXMax

英文短剧付费独立站。公开品牌为 **ShortXMax**。前台 100% 英文（浏览、播放、注册、订阅、SEO / GEO），后台 `/admin` 为中文管理面板（剧集、分集上传、套餐、支付、订单、用户）。

代码仓库目录、systemd 服务名等工程路径仍可能写作 `lumereel`，这不影响对外展示的站点名与图标。

品牌名与站点地址可通过环境变量修改：

- `NEXT_PUBLIC_SITE_NAME`（默认 `ShortXMax`）
- `NEXT_PUBLIC_SITE_TAGLINE`（默认 `Short dramas that hook you in minutes.`）
- `NEXT_PUBLIC_SITE_URL`（默认 `http://localhost:3100`）

## 技术栈

- Next.js（App Router）+ TypeScript + Tailwind CSS
- Prisma + **SQLite**（本地）。之后换 PostgreSQL 只需改 `DATABASE_URL` 和 `prisma/schema.prisma` 里的 `provider`
- 邮箱 + 密码登录（JWT HttpOnly Cookie）
- 视频 / 封面先存在本地 `uploads/` 与 `public/uploads/`，代码里预留了 S3 切换说明（见 `src/lib/storage.ts`）
- 支付：**Demo Pay**（无需 Stripe 密钥即可跑通订阅）+ Stripe Checkout / Webhook（密钥齐全时启用）
- Docker Compose + Nginx，方便以后部署到 VPS

## 本地运行

需要 Node.js 20+。本仓库已在云电脑上初始化过数据库和种子数据。

```bash
cd /workspace/lumereel
cp .env.example .env   # 若还没有 .env
# 把 AUTH_SECRET 改成一串足够长的随机字符
npm install
npm run setup          # prisma generate + db push + 种子数据
npm run dev            # 开发模式，0.0.0.0:3100
# 或生产模式：
npm run build && npm start
```

停止开发服务：在对应终端按 `Ctrl+C`。若是后台进程，使用 `kill` 结束占用 3100 端口的 Node 进程：

```bash
# 查看
ss -ltnp | grep 3100
# 结束（把 PID 换成实际进程号）
kill PID
```

### 默认地址

- 前台：http://localhost:3100
- 后台：http://localhost:3100/admin
- 定价：http://localhost:3100/pricing
- Sitemap：http://localhost:3100/sitemap.xml
- Robots：http://localhost:3100/robots.txt
- GEO / LLM 简介：http://localhost:3100/llms.txt

### 默认账号（仅开发环境，上线前务必修改密码）

| 角色 | 邮箱 | 密码 | 说明 |
| --- | --- | --- | --- |
| 管理员 | `admin@lumereel.com` | `LumeReel#Admin2026` | 可进入 `/admin` |
| 演示用户 | `demo@lumereel.com` | `DemoUser#2026` | 无 VIP，有少量金币与观看记录，适合体验付费墙 |
| VIP 用户 | `vip@lumereel.com` | `DemoVip#2026` | 已开通年费 VIP，可直接看锁集 |

重置并重新灌入演示数据：

```bash
npm run db:reset
```

## 环境变量

见 `.env.example`。常用项：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 本地默认 `file:./dev.db`（相对 `prisma/` 目录） |
| `AUTH_SECRET` | 登录 Cookie 签名密钥，生产环境必须更换 |
| `UPLOAD_DIR` | 本地上传目录，默认 `./uploads` |
| `DEMO_PAY_ENABLED` | 默认 `true`。设为 `false` 时关闭演示支付 |
| `STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | 配置后前台出现 Stripe 银行卡支付 |
| `S3_BUCKET` 等 | 预留，接入对象存储时使用 |

也可以在后台「支付收款」「站点 SEO 设置」里保存部分配置。若环境变量已填写，则以环境变量为准。

Stripe Webhook 端点：`{NEXT_PUBLIC_SITE_URL}/api/webhooks/stripe`，监听 `checkout.session.completed`。

## 功能一览

**前台（英文）**

- 首页：主视觉 Hero、热门 / 新剧 / 类型轨道、继续观看、社会证明、订阅 CTA
- 目录、类型页、搜索（全部分页，不会一次拉出全部剧集）
- 剧集详情：简介、标签、评分、分集列表、免费 / 锁定、相关推荐、评论；仅目录（尚无正片）的导入剧展示封面/简介/集数和订阅 CTA，不出现损坏的播放器，分集列表标明即将上线
- 播放器：切集、付费墙（短预览后锁定）、VIP 或金币解锁、自动连播、进度续看
- 定价：周 / 月 / 年 VIP + 金币包；Demo Pay 或 Stripe
- 注册 / 登录 / 账户（我的片单、历史、订阅状态）
- 法律页（条款、隐私、退款）、About、FAQ、主题导读（GEO）

**后台（中文，`role=admin`）**

- 仪表盘：用户、订阅、营收、热门剧
- 剧集管理：标题、Slug、简介、类型、标签、封面、状态、免费集数、SEO；支持搜索/筛选来源、外部 ID、仅目录 / 有正片，列表分页
- 目录导入：`/admin/catalog` 查看导入统计与重跑说明，脚本 `npm run db:import-catalog`
- 分集 / 视频上传：上传、排序（集号）、发布 / 下架、免费或锁定
- 订阅套餐与金币包
- 支付收款：Stripe 密钥、Webhook 说明、Demo Pay 开关、收款方式列表
- 订单列表（状态、金额、用户、时间，可标记退款）
- 用户管理（订阅状态、禁用）
- 站点 SEO 设置

## 以后部署到 VPS

1. 把整个项目拷到服务器（不要提交 `.env` 和 `prisma/*.db`）。
2. 安装 Docker 与 Docker Compose，或直接安装 Node.js 20+ 与 Nginx。
3. 复制 `.env.example` 为 `.env`：
   - 生成新的 `AUTH_SECRET`
   - 把 `NEXT_PUBLIC_SITE_URL` 改成你的域名，例如 `https://www.example.com`
   - 需要真实收款时填入 Stripe 密钥，并可把 `DEMO_PAY_ENABLED=false`
4. **仍用 SQLite（小站点最简单）**：保持 `DATABASE_URL="file:./dev.db"`，注意把 `prisma/` 和 `uploads/` 放到持久磁盘。
5. **改用 PostgreSQL（推荐上线）**：
   - 安装或使用托管 Postgres
   - 将 `prisma/schema.prisma` 中 `provider = "sqlite"` 改为 `provider = "postgresql"`
   - 设置 `DATABASE_URL="postgresql://用户:密码@127.0.0.1:5432/lumereel?schema=public"`
   - 运行 `npx prisma db push`（或 `prisma migrate dev` / `migrate deploy`）和 `npm run db:seed`（可选）
6. 启动：

```bash
docker compose up -d --build
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed   # 仅首次，或你想要演示数据时
```

7. 在域名 DNS 指向服务器后，为 Nginx 配置 HTTPS（Let’s Encrypt / Certbot）。`nginx/nginx.conf` 里预留了 443 与证书挂载注释。
8. 把 `client_max_body_size` 已设为 512m，方便后台上传视频。大文件建议之后改走 S3 / 对象存储，并让 Nginx 或 CDN 直出 `/uploads/`。

不使用 Docker 时：`npm run setup && npm run build && npm start`，再用系统 Nginx 反向代理到 `127.0.0.1:3100`。可用 `scripts/start.sh` 作为参考。

## 对象存储（以后）

当前上传入口集中在 `src/lib/storage.ts` 的 `saveUpload`。当设置了 `S3_BUCKET` 后，在该函数中改为上传到 S3（或兼容的 Endpoint），返回 `S3_PUBLIC_BASE_URL` 下的公开地址即可，页面无需大改。

## 许可与内容说明

站点为原创品牌演示，剧情、文案与海报均为新创作，不使用其他短剧平台的商标或素材。上线前请替换演示账号密码，并按你的公司主体更新法律页面中的运营者信息。


## 优惠活动

后台「优惠活动」可设置名称、英文角标、适用的 VIP 套餐 / 金币包、原价与促销价、开始与结束时间（按 **Asia/Shanghai，UTC+8**），以及是否显示倒计时、是否启用。

前台会读取**当前进行中**的活动：顶栏、定价页、`/go` 广告落地页、类型页与底部订阅按钮会显示划线价与实时倒计时（前端每秒更新，不必整页刷新）。结账（Demo Pay / Stripe / PayPal）按促销价创建订单。

演示数据已预置一场 **7-Day Launch Sale**（周卡 $2.49、月卡 $4.99、年卡 $29.99，结束时间在种子运行后 7 天）。若要只刷新活动而不清库：

```bash
npm run db:promo
```

## 广告落地页与像素

- 通用 VIP 落地页：`/go`
- 类型落地页：`/go/ceo-romance`、`/go/revenge`、`/go/werewolf`、`/go/hidden-identity`、`/go/billionaire`
- 这些页面针对应用内浏览器做了精简顶栏、单一报价、社会证明、划线价与倒计时；`utm_source` 等参数会写入 Cookie，并随注册与订单保存。
- 在「站点与广告像素」中粘贴 **真实的** Meta / TikTok / Google ID（不要虚构）。填写后会自动发送 PageView，以及 ViewContent（剧集页）、InitiateCheckout（定价/落地页）、Purchase（支付成功页）。

`sitemap.xml` 与 `llms.txt` 已包含类型中心、落地页与活动说明，避免与目录页成为空洞重复门页。

## 后台界面风格

登录 `/admin` 后，顶栏「界面风格」可即时切换，选择会写入 Cookie 并保持：

1. 深色金黑影视  
2. 明亮简约  
3. 蓝色商务侧栏  
4. 紫黑潮流  

风格会作用到侧栏、表格、表单、按钮等整个后台。后台文案保持中文。

## PayPal 与 Stripe

在「支付收款」或环境变量中配置：

- Stripe：测试 / 正式密钥可分别保存，用模式开关切换。Webhook：`{SITE_URL}/api/webhooks/stripe`，事件 `checkout.session.completed`。
- PayPal：Client ID + Secret，沙盒或正式。结账使用 Orders API（一次性支付开通对应周期 VIP）。返回页会 capture；Webhook `{SITE_URL}/api/webhooks/paypal` 监听 `PAYMENT.CAPTURE.COMPLETED` 作为补单。
- Demo Pay 可继续用于无密钥预览。

环境变量见 `.env.example`（`STRIPE_*`、`PAYPAL_*`）。环境变量优先于后台保存的值。

## 视频存在哪里：本地与 Cloudflare R2

新的封面和视频**默认上传到 R2 Studio**（https://r2.open-traffic.com）。也可以在后台配置并启用官方 Cloudflare R2 节点。新文件不会写入本机磁盘，上传失败时也不会悄悄回退到本地。未配置可用的 R2 Studio Key 或 Cloudflare R2 节点时，上传会明确失败，并提示到 `/admin/storage` 完成配置。站点里已有的本机演示媒体仍可播放，不会删除。

后台「存储设置」仍可添加**多个**官方 Cloudflare R2 端点（标签、Account ID、Access Key / Secret、Bucket、Endpoint、公开域名、权重）。启用官方 R2 后，上传按权重轮询，某个节点失败会尝试其他已启用节点或已配置的 R2 Studio，但不会回退到本地磁盘。播放使用对象的公开 / CDN 地址。

支持多端点是为了正规的扩容与容灾，**不是**为了用大量个人免费账号规避 Cloudflare 限额——那种做法有封桶、成片集体下线的风险。


## R2 Studio（实时进度与存储池）

后台 `/admin/storage` 默认把 **R2 Studio**（地址 `https://r2.open-traffic.com`）作为新上传通道。也可以改走已启用的官方 Cloudflare R2 节点。新文件不再写入本机磁盘。

### 如何填写 Key
1. 在 R2 Studio 控制台创建一个**带上传权限**的 API Key（以 `r2s_` 开头；明文只显示一次）。
2. 把 Base URL（一般不用改）和 Key 填到「存储设置」的 R2 Studio 区域。也可以把 Key 写在服务器环境变量 `R2_STUDIO_API_KEY`（可选 `R2_STUDIO_BASE_URL`），环境变量优先于后台保存值。
3. 先点「测试连接」。测试只请求只读接口 `GET /api/v1/pool?lite=1`，不会写入或删除对象。
4. 测试成功后再点「开始使用 R2 Studio」。未通过测试不会切换存储方式，也不会假装已经连上。

密钥只保存在服务器，不会下发到前端、不会写进日志或本说明。文档里的 `r2s_你的Key` 只是占位符，不要把它当作真实密钥填写。

### 上传与进度
- 小于等于 64MB：服务端 `PUT /api/v1/objects/...`，并带上 `X-Upload-Id`。
- 大于 64MB：按文档走分片（创建 → 上传分片 → 完成）。
- 成功后把返回的 `publicUrl`（或 `shortUrl`）写入封面/视频字段，前台即可显示或播放。
- 后台通过**本站 API 反代**订阅 SSE（`/api/admin/r2s/events` 与单任务事件），浏览器 EventSource 不会带 Key，也避免直接跨域访问对方接口。进度区展示百分比、速率、剩余时间（未知时为 -1）和当前写入账号，可以取消进行中的任务。存储池用量与成员随 `pool` 事件更新。

未配置 Key 时，测试按钮会给出中文失败原因，上传会被拒绝且不会写入本地；不要对外部服务做实际上传，也不要假装上传成功。R2 Studio 的公开地址与 Cloudflare R2 一样不是 DRM，拿到原始 URL 的人仍可能直接访问。

## 后台运营（数据看板、轮播与 R2）

- 后台默认风格为浅色商务（Ant Design 风格）。右上角可切换其他主题，保存在 cookie `lumereel_admin_ui`。
- **首页与轮播**：在 `/admin/home` 添加、排序或停用幻灯片后，英文首页顶部会立即改用这些幻灯片（时间窗口内且已启用）。全部停用时回退到热门剧封面。
- **分类 / 推荐标签**：`/admin/categories` 和剧集上的「推荐 / 热门 / 新片 / 上架」会驱动 `/genres`、`/go/[genre]` 和首页栏目。
- **数据看板**：统计 Asia/Shanghai 时间范围内的访问、注册、订单、GMV、退款和 VIP。前台浏览会写入访问日志（不含 `/admin`），刷新看板即可看到。
- **Cloudflare R2**：打开 `/admin/storage`，按页面上的 4 步填写账户 ID、桶名、Access Key、Secret Key、公开地址。先「测试连接」（会真实写入并读取一个小文件），成功后再点「开始使用 R2」。未测试通过前不会启用该官方节点，新上传也仍不会写入本机磁盘（请改用 R2 Studio，或完成官方节点配置）。起步一个正式桶即可；第二个节点用于轮询与故障切换。不要用大量个人免费账号规避限额。
- **R2 Studio**：同一页上方可填写 Base URL 与 API Key，测试连接成功后再启用。详见上一节「R2 Studio」。

## 注册、账户中心与独立会员管理（2026-11-19）

### 已打通的入口
- 英文导航 **Join free / Sign in** → `/signup`、`/login`；原来已有注册和登录，这次补齐后端格式/长度校验、重复注册竞态处理、错误提示、网络异常处理、安全站内回跳。
- 账户中心 `/account`：有效会员套餐及到期时间（Asia/Shanghai）、金币、订单历史、收藏、观看记录。`/account/settings` 可改显示名、校验当前密码后修改密码。邮箱不可随意修改：目前未接邮箱验证服务，不假装已验证。
- 密码由 bcrypt 保存；限制 8 字符起、72 UTF-8 字节上限，避免 bcrypt 截断。不会在前后台输出密码或 hash。
- 退出登录/修改密码/封禁会递增数据库 sessionVersion；后续请求校验数据库角色、状态和版本，不仅相信旧 JWT。修改密码后保留当前新会话，旧会话失效。封禁解除后必须重新登录。
- 后台 `/admin/users` 搜索邮箱/显示名、筛选状态/会员、每页 15 条。`/admin/users/{id}` 查看注册来源、会员记录、订单和观看记录，调整金币。
- 独立 `/admin/members`：有效、到期/撤销会员目录。用户详情内可授予/延长（1–3650 天）/撤销全部会员；必须填写原因并确认，写入 AdminAudit 日志，防止普通用户越权。撤销是站内权限操作，不是外部退款。

### 支付和鉴权一致性
- Demo Pay 显示 **preview, no real charge**，演示成功不是 live payment 已验收。Demo 不触发 Purchase/InitiateCheckout 广告转化。
- 所有支付发放通过同一事务：仅 pending→paid 可发放；每个订单最多一个会员权益（Subscription.orderId 唯一）；重复回调、failed/refunded 终态不会再发权益。Demo API 及正式支付创建都需要 Idempotency-Key，前台自动生成并在网络重试时复用；Stripe/PayPal 还传入各自幂等键。
- Stripe 验签后还核验 paid、金额、币种及 processor ref；PayPal webhook 必须配置 Webhook ID 且验证 SUCCESS，仅 CAPTURE.COMPLETED 可发放（APPROVED 不是到账）。PayPal 回跳核对订单归属、provider ref 及官方 COMPLETED capture 金额/币种，不拿任意 token 开会员。
- 订单回执只读当前用户的对应订单，不把“最近一次旧支付”伪装成本次已付。观看/付款后使用安全的站内 next 回跳。`//外站`、反斜杠、控制字符跳转被拒绝。
- `/api/playback/{episodeId}` 每次重新验证上架状态、封禁、会员有效期/金币解锁。付费本机视频不再通过 `/public/uploads/videos` 静态公开；原副本移至 `backups/public-videos-before-auth`，原 `uploads/videos` 保留。上传层对视频仅写非 public 路径。直接 `/uploads/videos/...` 返回 403。
- **重要边界**：当前 R2 是公开 CDN 地址模式，不是 DRM。应用入口验证权限，但获得 R2 原始公开 URL 的人仍可直接访问。真正付费媒体防盗链需下一步改私有桶 + 短时签名 / CDN token / HLS；本次不伪称已具备。
- Next Server Actions 自带 Origin 检查，所有 mutation API 另有 same-origin/Fetch-Metadata 防 CSRF（webhooks 使用独立支付签名）；后台 action/API 均检查实时管理员身份。Cookie HttpOnly/SameSite=Lax，生产 Secure，公网部署务必 HTTPS；loopback HTTP 测试程序仅在本地显式转发 Secure cookie。
- 单进程登录/注册限流：每个邮箱每 15 分钟 20 次；多节点生产需共享限流/WAF。不是完整反机器人或 MFA 系统。
- 当前只允许在后台撤销 Demo 订单权益；Stripe/PayPal 真实退款、拒付、循环订阅生命周期尚需独立集成/人工核对，不能点一下仅改本地状态却声称退款成功。

### 邮件和真实支付依赖
未接可用邮件服务，因此邮件验证、忘记密码重置不提供可点击的假成功入口，不发送真实邮件。没有建立外部账户、没有配置/读取真实密钥，没有执行真实扣款或外部退款。Stripe/PayPal 的正式/测试配置入口保持原有，真实端到端交易需要运营者提供配置并单独授权验收。

### 回归与备份
- 升级前使用 SQLite backup API 创建 `backups/before-auth-members-20261119-111640.db`。迁移仅新增字段、索引和表，无 reset；无歧义的历史订单/权益用 `npx tsx prisma/link-legacy-orders.ts` 关联，不猜测多订单场景。
- `python3 tests/auth-members.integration.py`：真实 HTTP 注册→登录→Demo→付费媒体→后台延长/撤销→失效/封禁/恢复→资料/密码/退出；操作使用实际页面表单，不是只测 UI 文字。随机 `@example.invalid` 测试用户与临时操作员在 finally 清理，订单、会员、日志全部清理，不混入最终统计。
- `npx tsx tests/fulfillment.integration.ts`：并发重复回调、金币仅发一次、退款/失败订单不重发，清理全部隔离记录。
- 脱敏结果在 `test-results/auth-members.json`、`test-results/fulfillment.json`，不含测试口令或会话 token。此轮没有浏览器，没有生成或声称新截图。验收路径：`/signup`、`/login`、`/account`、`/account/settings`、`/admin/users`、`/admin/members`、`/admin/users/{真实用户ID}`。

## 目录导入（2026-11-20）

用户已选择把全部 **12,987** 部英文短剧目录导入本站。这是目录信息导入，**不是**正片入库。

### 保留与首页
- 导入前备份：`backups/before-catalog-import-20261120-173259.db`。
- 原 12 部演示剧、用户、订单、促销、轮播、分类全部保留，不被覆盖或删除。
- 首页轮播 / 推荐 / 热门 / 新片仍只由演示剧和后台开关驱动。导入剧默认 `isFeatured/isTrending/isNew` 为关，`isCatalogOnly` 为开，不会涌进首页。
- 现有 5 个前台类型（CEO Romance / Revenge / Werewolf / Hidden Identity / Billionaire）不会被源数据里的「未定义」等题材污染；未映射题材写入 `genre=catalog`（前台显示 Short drama），不进入类型轨道。

### 导入规则
- 数据文件：`/workspace/lumereel-imports/english-short-dramas.xlsx`（工作表「数据」）。
- 幂等键：工作表「剧集ID」→ `Series.externalId`。重跑只更新目录字段，不重复插入，不改已有 slug 和首页标签。若某部后来已有分集视频，不会被改回「仅目录」。
- 写入标题、原标题、简介、远程封面 URL、集数（`totalEpisodes`）、付费/免费、上架与完结状态、阅读/收藏数、创建时间、外部剧集 ID / 交易 ID / 主键、来源。语言统一为 English。hook 取简介首句，否则用标题。
- slug 必须唯一：标题 slug + 剧集 ID 后 8 位，用于处理重复标题（如 Crown of Vengeance）。
- **不为缺视频的导入剧创建 Episode 行**（平均约 50 集，否则会膨胀数十万行）。
- **不下载 1.3 万张封面**。封面存远程 URL。`next.config.ts` 已允许 `video.provideoshort.com`、`cdn.provideoshort.com`、`videohk2026.oss-cn-hongkong.aliyuncs.com`。前台封面用 `SafeCover`，加载失败显示占位，不导致整页崩溃。
- 免费剧仍按现有规则设置 `freeEpisodeCount`（最多 3 集）；付费剧为 0，上线后仍需会员/解锁。

### 规模
- 公开 `/shows`、`/search`、类型页和后台 `/admin/shows` 均分页（前台 40 / 后台 20），并给 `status+viewCount`、`createdAt`、`genre`、`isCatalogOnly`、`source`、`title`、`externalId` 等加了索引。
- `sitemap.xml` 使用 Next.js `generateSitemaps` 分片（每片最多 4000 条），避免一次吐出 1.3 万 URL 超时。`llms.txt` 只详列可播放剧，并注明其余目录规模。

### 重复导入
```bash
npm run db:import-catalog
# 或
python3 prisma/import-catalog.py --xlsx /workspace/lumereel-imports/english-short-dramas.xlsx
```
后台说明页：`/admin/catalog`。上次运行摘要写入 `test-results/catalog-import.json`。

### 已知缺口
导入剧目前没有单集视频地址。详情页可以浏览，但不能播放；访问 `/watch/{slug}/1` 会回到剧集页，而不是坏掉的播放器或 404。正片需要后续单独入库后再在「分集 / 视频上传」里添加。
