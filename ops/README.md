# DateXray Operations Workbench

这是 `@DateXray` 的本地运营工作台，与公开站代码和部署完全隔离。当前实现 X 内容工作流；TikTok 和 Reddit 只保留入口。

## 本地启动

要求 Node.js 20.9 或更新版本。

```bash
cd /Users/sunbaogangdemac/dateradar/ops
npm install
cp .env.example .env.local
```

编辑 `.env.local`，只填服务端 DeepSeek key：

```bash
DEEPSEEK_API_KEY=your_key_here
```

不要把 key 写进源码、JSON、测试、日志或 Git。启动工作台：

```bash
npm run dev
```

浏览器打开 [http://127.0.0.1:3100](http://127.0.0.1:3100)。开发服务器只监听本机回环地址。

## 工作流

1. 在“今日工作”查看今天的节奏：反诈、进度、互动各一条。
2. 在“X 生成器”输入中文或英文素材，或导入最近 7/14/30 天的 Git 提交。
3. 选择六类内容之一，用 DeepSeek 同次生成三版英文推文（每版不超过 280 字符），以及中文角度、忠实对照译文和表达策略。
4. 阅读中英对照后编辑英文。修改正文会显示“英文已修改，中文对照待更新”；点击“更新中文对照”只翻译这一版当前英文，不改写正文。
5. 点击“复制并记入台账”。复制和台账最终文案仅包含英文正文；中译和策略说明不会拼入推文。若中译过期，旧译文仍保留并明确标注，建议更新后再发布。
6. 在“内容台账”搜索或复用历史内容；发布后在“数据复盘”回填 X 链接、发布时间和互动数据，并标记高表现内容。

工作台不会连接 X 账号，也不会自动发布任何内容。

中文对照更新需要联网调用 DeepSeek。每版独立维护对应的英文与译文；英文再次修改或重新生成后，旧请求的迟到结果会被忽略。更新失败保留英文和上次译文，可重试。草稿和中译暂存于当前页面，刷新页面会丢失未入账草稿；历史台账格式不变。

双语审阅的字段、同步规则与验收步骤见 [双语审阅说明](docs/bilingual-review.md)。配图生成将在本阶段验收后另行实现。

## 本地数据与 Git

可提交的静态配置：

- `data/brand-voice.json`
- `data/content-types.json`
- `data/visual-templates.json`
- `data/topics.example.json`
- `data/content-ledger.example.json`

只保留本地、已被 `/ops/.gitignore` 忽略的运行数据：

- `data/topics.json`
- `data/content-ledger.json`
- `data/*.tmp`
- `.env.local`

首次读取时，工作台从对应的 `*.example.json` 自动创建本地运行文件。数据跟随当前电脑，不会自动上传或备份；如需备份，请自行复制两个运行 JSON 到安全的私有位置。

## 检查命令

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

公开站仍从仓库根目录独立运行：

```bash
cd /Users/sunbaogangdemac/dateradar
npm run dev
```

它不会加载 `/ops` 的依赖、页面或运行数据。
