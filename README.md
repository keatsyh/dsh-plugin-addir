# dsh-plugin-addir

> 参考 **Codex** (`--add-dir`) 与 **Antigravity** (Active Workspaces 多根目录关联) 机制，为 DeepSeek Harness (DSH) 提供工作区多目录关联、上下文注入与协同管理的 Cordis 插件。

---

## 📖 背景与设计理念

在复杂开发中（例如微服务协同、前后端分离、跨仓库组件库依赖、API规范与设计文档等），编码智能体通常需要跨多个项目目录进行代码检索、阅读与协同编辑。

- **参考 Codex**：Codex 提供了 `--add-dir <path>` 机制，允许会话中随时动态挂载受信任的附加目录，将其加入智能体的探索范围与沙箱可写许可集合中。
- **参考 Antigravity**：Antigravity 原生支持多个活动工作区（Active Workspaces），每个工作区目录映射一个规范化绝对路径（`URI`）和一个语义名称（`CorpusName`，如 `frontend`、`backend`），并在系统上下文（System Prompt）中结构化呈现实时的工作区拓扑。

本项目结合了两者的设计精髓，在 DeepSeek Harness 的 Cordis 体系下实现了全自动的多目录协同体验。

---

## ✨ 核心特性

1. **零配置开箱即用 (Zero-Config Out of the Box)**
   - 所有的配置项（智能体工具、上下文注入、只读保护）均已内置最合理的默认值；
   - 在 profile 或配置补丁中只需声明插件名称即可自动启用全部功能，完全无需手写额外参数！

2. **多目录拓扑与别名系统 (Multi-Root & Alias)**
   - 区分会话主工作区（`Primary root`，即会话启动时的 `cwd`）与关联目录（`Linked directories`）。
   - 自动路径规范化（`fs.realpathSync.native` 彻底解析软链接，防止路径遍历与重复）。
   - 每一个关联目录支持语义别名（`alias`，类似 Antigravity 的 `CorpusName`）、描述（`description`）以及只读标记（`readOnly`）。

3. **智能体上下文注入 (Context / Prompt Injection)**
   - 在智能体执行的 `agent/pre-step` 阶段，如果检测到当前工作区关联了多个目录，自动在模型上下文中注入清晰的 `# Active Workspace Directories` 结构化指南：
     ```markdown
     # Active Workspace Directories
     The workspace is configured with multiple linked directories:
     - [primary] `/Users/bear/project/frontend` (Primary root)
     - [backend] `/Users/bear/project/backend` - Microservice API services
     - [specs] `/Users/bear/project/specs` [Read-Only] - API documentation & schemas

     **Navigation and Guidelines**:
     - All file reading, searching, and execution tools accept paths located inside any of these directories.
     - You can use full absolute paths or alias-prefixed paths (e.g. `[alias]/path/to/file` or `alias:path/to/file`).
     - Respect directories marked with `[Read-Only]`: only inspect and read from them, do not attempt to write or edit files there.
     ```

4. **便捷路径别名展开 (Path Alias Resolution)**
   - 支持简写别名路径，例如：
     - `[backend]/src/server.ts` 自动解析为对应实际绝对路径。
     - `specs:schemas/user.json` 自动解析为对应实际绝对路径。

5. **安全保护与沙箱协同 (Read-Only Guard & Sandbox)**
   - 对标记为 `readOnly: true` 的参考目录实施写入拦截保护（针对 `write` / `edit` 等工具操作），防止智能体意外修改参考库。
   - 提供 `getWritableWorkspaceRoots`，可将所有可写的关联目录加入沙箱策略（Sandbox Policy）的放行根路径中。

6. **智能体交互工具集 (Agent-facing Tools)**
   - `addir_list`：列出当前工作区关联的所有目录、主次标识、别名及状态。
   - `addir_add`：动态关联新目录（类似 Codex `--add-dir`）。
   - `addir_remove`：从工作区解除关联（保护主工作区不被误删）。

---

## 🚀 安装与配置

### 1. 安装

**从 npm 安装（推荐）**

```sh
# profile 名按你实际使用的填：web / headless / 自定义名
dsh plugin --profile web add dsh-plugin-addir

# 桌面端：先启动一次应用初始化 profile，完全退出后再执行，然后重开应用
dsh plugin --profile desktop add dsh-plugin-addir
```

也可以在 DSH 的**设置 → 插件管理**（或插件市场）里搜索 `dsh-plugin-addir` 一键安装并启用。

**从源码安装（开发）**

```sh
git clone https://github.com/keatsyh/dsh-plugin-addir.git
cd dsh-plugin-addir
pnpm install                 # prepare 会自动构建出 lib/
dsh plugin --profile web add "link:$PWD"
```

### 2. 安装即启用，零配置

本包自带 bundle patch（`dsh.bundle.patch`），安装后会把 `id: addir` 这一行插入 profile，不需要手写 `insert`。默认值：

- `enableTools: true`（注册 `addir_list` / `addir_add` / `addir_remove` 三个工具）
- `enableContextInjection: true`（每轮向模型注入 Active Workspace 说明）
- `enforceReadOnly: true`（拦截对只读关联目录的写入）

### 3. 可选：覆盖配置

在 profile 的 `cordis.patch.yml` 里按 id 覆盖（或在设置界面里改）：

```yaml
- id: addir
  config:
    enableTools: false            # 例如：不让智能体自主增删目录，只在界面里管理
    enableContextInjection: true
    enforceReadOnly: true
    defaultDirectories:           # 启动时静态预设的关联目录
      - path: '/Users/bear/Coder/jscode/deepseek-harness'
        alias: 'dsh-core'
        description: 'DeepSeek Harness 核心库源码'
        readOnly: true
```

---

## 工作区编辑与全局设置

点击工作区行的三个点，选择“编辑”，打开“编辑项目”弹窗。弹窗支持修改项目名称、查看主文件夹、添加或移除关联文件夹、设置只读标记。点击“添加文件夹”直接通过 DSH 打开系统原生目录选择器；选中目录后加入项目草稿，取消选择不改动目录列表。目录别名由文件夹名称生成，也可通过工具或 Host API 设置。点击“保存”提交名称和完整目录列表；“取消”、关闭按钮和 Escape 放弃尚未保存的修改。主文件夹由 Workspace 的路径确定。

“移除本地项目”需要在弹窗中确认，仅移除 Workspace 注册，保留磁盘文件与会话。

设置页“关联目录”仅管理三个 profile 全局开关：智能体目录工具、目录上下文注入、只读写入检查。保存通过 DSH 配置编辑器写入 profile 并重新加载插件；静态 `defaultDirectories` 保留在 YAML 配置中。工作区目录关联按规范化根路径保存到 `$DSH_HOME/storages/addir.json`，重启后恢复。

客户端通过插件内的 DOM 适配在工作区三点菜单中添加「编辑」，通过上游已有的 `shell.overlay` 和 `settings.section` 注册弹窗与设置，无需修改 DSH 源码。适配依赖工作区行的 `data-row-key`、首个操作按钮及原生菜单结构；DSH 更新这些结构时需同步调整 `src/client/workspace-menu.ts`。适配只复制原生重命名行的样式与图标，不复制操作行为，卸载插件时移除菜单项和监听器。设置页中的工作区列表也提供「编辑」入口，菜单结构变化时仍可管理目录。HTTP 路由随 `webServer` 服务挂载和释放，完整目录提交在验证全部路径与别名后写入；HTTP 或非 JSON 错误在弹窗内显示并保留草稿。

---

## 🛠️ 智能体工具说明 (可选辅助)

| 工具名 | 参数 | 描述 |
|---|---|---|
| `addir_list` | 无 | 查看当前工作区关联的所有根目录、主目录标记、别名、只读属性和描述 |
| `addir_add` | `path` (必需), `alias` (可选), `description` (可选), `readOnly` (可选) | 动态关联一个目录到当前工作区（参考 Codex `--add-dir`） |
| `addir_remove` | `pathOrAlias` (必需) | 移除关联的附加目录（主目录禁止移除） |

---

## 💻 开发者 API (`ctx.addir`)

在其它插件或 Host 服务中，可直接调用 `ctx.addir`：

```typescript
// 1. 获取当前会话关联目录列表
const dirs = ctx.addir.list(sessionId)

// 2. 动态添加目录
await ctx.addir.add({
  path: '/path/to/another-repo',
  alias: 'shared-utils',
  description: '公共工具函数库',
  readOnly: true,
}, sessionId)

// 3. 别名解析为绝对路径
const fullPath = ctx.addir.resolvePath('[shared-utils]/math.ts')

// 4. 判定路径是否在关联的工作区范围内
const isInside = ctx.addir.isUnderWorkspace('/some/file.ts')

// 5. 判定路径是否只读
const isRo = ctx.addir.isReadOnly('/some/file.ts')
```

---

## 🧪 运行测试与构建

```bash
# 运行单元测试与集成测试
pnpm test

# 类型检查
pnpm run typecheck

# 编译打包 (输出至 lib/)
pnpm run build
```

Web 客户端通过经典脚本加载插件。`lib/client.js` 必须调用 `window.__ModuleLoader__.load({ id, factory })` 注册延迟执行的模块工厂；ESM `import` / `export` 不能直接出现在此文件中。React、JSX runtime 和 React DOM 从 DSH 的共享模块表解析，客户端声明文件由 TypeScript 单独输出到 `lib/types/client/`。`pnpm run build` 包含客户端产物检查，也可通过 `pnpm run check:client-bundle` 单独检查。修改客户端后运行 `pnpm run build`，重启 Web Host 并刷新页面。

---

## 📄 许可证

MIT License
