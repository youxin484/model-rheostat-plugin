# model-rheostat-plugin

DSH 第三方插件：在 composer 输入框右下角、**模型选择器紧左侧**放一个「滑动变阻器」控件，
用来直接调节当前会话的**模型强度**（推理强度 / reasoning effort）。

模型版本选择（官方 `conversation.input.model`）保持原样不动——变阻器是加在它旁边的，
不替换、不遮挡官方控件。

## 效果

```
┌─ 输入消息… ────────────────────────────────────────────────┐
│ ＋  默认权限              强度 ▬▬▬🐳▬▬  High   DeepSeek Flash High ⌄   ↑ │
└────────────────────────────────────────────────────────────┘
                            └── 变阻器 ──┘  └──── 官方模型选择器 ────┘
```

- 轨道是「绕线」质感（重复线纹），滑钮是**官方 DeepSeek 鲸鱼标**（白底圆片 + 品牌色标记）。
- 左端 = `Off`，右端 = `Max`；填充色精确停在滑钮中心。
- 鼠标拖动 / 点击轨道 / 键盘 ←→ / Home / End 都能换档（原生 `input[type=range]`）。
- 悬停显示该档位的名称与说明（说明文案来自适配器的元数据）。

### 滑钮为什么是「圆片 + 图标」而不是纯剪影

鲸鱼标单独画成剪影时，无法在蓝色填充段和灰色轨道段上同时保证对比度（浅色主题的深色剪影在填充上勉强、深色主题的浅色剪影在轨道上又消失）。
所以滑钮 = 白底圆片（`--dsw-alias-bg-layer-1`，深色主题自动变深）+ 品牌色鲸鱼，两种主题、两种轨道背景下都清晰。

实现上，原生 `input[type=range]` 的滑钮被设为透明（**只保留 14px 命中区**），视觉滑钮由 `[data-mrh-thumb]` 画在同一个中心点上——
这样才能把 SVG 图标放进滑钮，而不是只能给伪元素设背景图。因此 **14px 是几何契约**：
它决定滑钮中心两端各内缩 7px，必须与轨道的 `left/right: 7px` 内缩一致。改动前请先看下面的几何校验。

图标几何取自 DSH 自带的官方品牌包 `@deepseek-ai/dsh-client-ui-primitives` 导出的
`FISH_LOGO_PATH` / `FISH_LOGO_VIEWBOX`（即官方 `dsh-client-ui-brand-official` 渲染侧栏品牌标的同一份数据），
由 `scripts/extract-fish-logo.mjs` 从 `app.asar` 原样注入到 `client.js`，请勿手改那两行。
**DSH 升级后重跑一次**即可跟随官方新图形：

```sh
node scripts/extract-fish-logo.mjs --force                      # 自动探测常见安装位置
node scripts/extract-fish-logo.mjs --force --asar <app.asar>    # 或显式指定（也可用 $DSH_ASAR）
```

`app.asar` 就在 DSH 可执行文件旁边的 `resources/` 下；不确定位置时可用
`(Get-Process 'DeepSeek Harness').Path` 找到主程序，再取其同级 `resources\app.asar`。

## 档位来源

档位**完全来自适配器公布的元数据**，不写死、不编造：

| 提供方 | 档位 |
|---|---|
| DeepSeek / DeepSeek 账号 | `off` Off · `low` Low · `high` High · `max` Max |
| pi-ai 系列（如本机 Ollama） | 由 `getSupportedThinkingLevels(model)` 决定 |

模型没有推理元数据、或只公布一个档位时，**整个控件不渲染**——与官方
「适配器没有推理元数据时不显示 Effort 行」的约定一致。

## 为什么和 `/model` 菜单永远一致

控件与官方 `/model` 弹窗、composer 模型菜单**共用同一个 `ModelDirectory` 实例**
（客户端服务 `ctx.modelDirectories.directoryFor(sessionId)`）：

- 读：目录 store 快照 `{ current, pending, status, groups }`
- 写：目录 `select({ provider, model, reasoningEffort })`

因此任一边改档位，另一边立刻同步；也不会出现「变阻器显示的和菜单里选的不一样」。
提交走「最新值优先」的串行队列：快速拖动时中间档位会被合并，只保证最终档位送达。

## 安装

已装入 `desktop` profile（`link:` 本地依赖，改源码即时可重新加载）：

```sh
dsh plugin --profile desktop add <本目录路径>
```

装卸状态见 `~/.dsh/profiles/desktop/package.json` 的 `dependencies` 与 `dsh.profile.bundles`。

## 配置

无。本插件不声明任何 Config（Host 半边是空 `apply`），因此插件页没有可配置项。

## 隔离 / 卸载

在 profile 的 `cordis.patch.yml` 里加：

```yaml
- id: model-rheostat
  disabled: true
```

即可停用本插件（无需卸载）。彻底移除用 `plugin_manager remove_bundle`。

## 结构

| 文件 | 职责 |
|---|---|
| `package.json` | `dsh.bundle.patch` + `dsh.client`（`platform: web`）声明 |
| `cordis.patch.yml` | 把自己的 Loader 行插入 profile 组合 |
| `.dsh-plugin/index.mjs` | Host 半边——空 `apply`，只为让包出现在 Loader 里 |
| `.dsh-plugin/client.js` | 浏览器半边——手写 bundle（`window.__ModuleLoader__.load`），无构建步骤 |
| `scripts/extract-fish-logo.mjs` | 从 DSH 的 `app.asar` 提取官方鲸鱼标几何并注入 `client.js` |
| `dev/preview/harness.html` | 离线回归渲染台（见下） |

`client.js` 直接可用：整个客户端半边只 `require("react")`（平台基座已提供），
不需要 esbuild/tsdown 打包，改完刷新页面即可。

## 开发校验

`dev/preview/harness.html` 是一个离线渲染台：
它加载**真实的** `client.js`、用真实 React 渲染、只把 DSH 的模型目录换成假数据，
用来在没有 DSH 界面的情况下验证组件逻辑与几何对齐。

```sh
node dev/fetch-react.mjs     # 下载 React UMD 到 dev/preview/vendor/（该目录不入库）
chrome --headless=new --dump-dom --virtual-time-budget=8000 <harness 的 file:// URL>
```

会输出形如：

```
ranges=6 ticks=24 thumbs=6 hiddenCase=ok mainRendered=yes selectCalls=0
| interactions=2 seq=max>high last=deepseek-account/deepseek-flash/high keys=model+provider+reasoningEffort
|| GEOM worst=0.01px :: off:knob-tick=0.00px/thumb=0.00px/fill=n/a(0)/rail=62.0px/margin=1.0px ; ...
```

覆盖：三个「必须不渲染」的用例（单档位 / 无推理元数据 / subagent 会话）、
提交载荷字段、快速拖动的合并行为、填充右缘与刻度中心的对齐误差、
**视觉滑钮（鲸鱼标）与原生滑钮中心的重合度**、以及**图标是否被圆片裁切**（`margin` ≥ 0.5px）。

把 `--dump-dom` 换成 `--screenshot=out.png --window-size=760,192 --force-device-scale-factor=4`
就能拿到控件外观的截图。

## 许可证

MIT
