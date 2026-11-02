<p align="center">
  <img src="./icon.svg" width="80" height="80" alt="dsh-plugin-addir logo">
</p>

<h1 align="center">dsh-plugin-addir</h1>

<p align="center">
  <b>让 DeepSeek Harness 支持多根目录工作区与上下文动态注入</b><br>
  灵感来自 OpenAI Codex <code>--add-dir</code> 与现代 AI IDE 多根目录工作区设计
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-plugin-addir"><img src="https://img.shields.io/npm/v/dsh-plugin-addir.svg?style=flat-square&color=2F6BFF" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.19-brightgreen.svg?style=flat-square" alt="node version"></a>
  <a href="https://github.com/keatsyh/dsh-plugin-addir"><img src="https://img.shields.io/badge/DeepSeek--Harness-Plugin-blueviolet.svg?style=flat-square" alt="DSH Plugin"></a>
</p>

<p align="center">
  <a href="./README.md"><b>简体中文</b></a> | <a href="./README.en.md"><b>English</b></a>
</p>

---

## 💡 为什么需要 addir？

在默认情况下，[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的工作区通常只绑定一个工作目录（Primary Root）。当面临以下复杂开发场景时常常受限：

- **跨仓库 / 跨模块协作**：前后端工程分离（如 `frontend/` 与 `backend/`），智能体需要同时理解接口定义与业务实现；
- **共享代码与公共库**：项目依赖独立的公共组件库（如 `shared-ui/`、`core-lib/`），需要跨目录检索却不想反复复制代码；
- **只读规格与文档参照**：引入只读的设计规范、API 契约或第三方代码，需要智能体参考但**绝不允许误改**。

`dsh-plugin-addir` 彻底打破单一工作区限制！它支持在当前工作区下**关联任意多个外部目录**，配合直观的图形化管理界面、自动上下文注入与细粒度只读保护，让智能体自如跨目录协同工作。

---

## ✨ 核心特性

- 📁 **多根目录关联（Multi-Root Workspaces）**  
  支持为任意工作区挂载多个额外文件夹，为每个目录配置易记的别名（Alias）、描述信息及只读（Read-Only）标记。
- 🧠 **上下文动态注入（Context Injection）**  
  目录表作为运行时上下文注入：会话开始时一份，仅在目录增删或只读标记变化时更新，不会逐步/逐轮重复追加。智能体可直接理解 `[别名]/path` 或 `别名:path` 路径简写。
- 🛡️ **细粒度只读防护（Read-Only Protection）**  
  勾选 `只读` 的目录将被文件工具守卫拦截 `write` / `edit` 操作，彻底避免智能体误改公共依赖或文档。
- 🖥️ **无缝原生 UI（Native GUI Integration）**  
  深度集成 DSH 工作区列表菜单（`⋯` → 编辑）。弹窗支持调用系统原生目录选择器，体验丝滑自然。
- 💾 **跨会话持久化（Auto Persistence）**  
  关联关系按工作区根路径隔离并持久化至本地存储（`$DSH_HOME/storages/addir.json`），应用重启后自动恢复。
- 🤖 **智能体自主管理（Agent Tools）**  
  内置 `addir_list`、`addir_add`、`addir_remove` 工具，允许智能体在对话中动态扩展视野；也可一键关闭权限，由用户完全掌控。

---

## 🖥️ 界面展示

### 1. 工作区菜单入口
在工作区列表中点击目标项目的「`⋯`」按钮，选择「**编辑**」：

![工作区菜单](assets/workspace-menu.png)

### 2. 多目录图形化管理弹窗
支持修改工作区名称、使用**系统原生目录选择器**添加文件夹、配置个性化别名，并可单独勾选「只读」权限：

![编辑项目弹窗](assets/workspace-editor.png)

---

## 注入到模型的上下文示例

启用 `enableContextInjection` 后，插件会把当前工作区的生效目录表作为运行时上下文注入。智能体循环只保留一份快照，只有目录表内容变化时才追加新的一份，因此同一轮内的多次工具调用不会重复注入：

```markdown
# Active Workspace Directories
- [primary] `/Users/dev/repo/frontend` (Primary root)
- [backend] `/Users/dev/repo/backend` - 核心 API 服务
- [specs] `/Users/dev/repo/api-specs` [Read-Only] - OpenAPI 契约定义
```

智能体能够据此识别每个目录的作用，并使用 `[backend]/src/app.ts` 或直接使用绝对路径进行高效分析。

---

## 🚀 快速上手

1. **安装插件**（参考下方[安装指南](#-安装指南)）；
2. **关联目录**：在工作区列表点击「`⋯`」→「编辑」，点击「**添加文件夹**」选择本地目录，设置别名（如 `backend`）并保存；
3. **开始对话**：直接对智能体说：
   > *"请阅读 [backend] 目录下的路由定义，并在当前前端项目中生成对应的 API 请求函数。"*

---

## 📦 安装指南

### 1. 通过 DSH 插件市场 / 设置面板安装
打开 DeepSeek Harness 桌面端或 Web 端，进入 **设置 → 插件管理**，搜索 `dsh-plugin-addir`，点击安装即可。

### 2. 通过命令行安装（推荐）

```sh
# Web Profile（推荐在 Web 版使用）
dsh plugin --profile web add dsh-plugin-addir

# 桌面端 Desktop Profile
# 注意：桌面端首次使用请先启动一次应用以初始化 profile，完全退出应用后再执行安装命令，随后重新打开应用
dsh plugin --profile desktop add dsh-plugin-addir

# Headless / 自定义 Profile
dsh plugin --profile headless add dsh-plugin-addir
```

> [!NOTE]
> 本插件自带 **bundle patch**（`cordis.patch.yml`），安装时会自动向 profile 注册 `id: addir`，**无需手动修改配置文件**。

### 3. 从源码构建安装（开发者模式）

```sh
# 克隆仓库
git clone https://github.com/keatsyh/dsh-plugin-addir.git
cd dsh-plugin-addir

# 安装依赖并构建（prepare 会自动编译 lib/ 产物）
pnpm install

# 软链接安装到目标 profile
dsh plugin --profile web add "link:$PWD"
```

---

## ⚙️ 配置说明

所有配置项均有合理的默认值。您可以在 DSH 的**插件设置页**中直观调整，或在 profile 对应的 `cordis.patch.yml` 中进行配置覆盖：

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enableTools` | `boolean` | `true` | 是否向智能体暴露 `addir_*` 工具（允许模型自己增删目录） |
| `enableContextInjection` | `boolean` | `true` | 是否将工作区目录表作为运行时上下文注入；目录表不变时不会重复注入 |
| `enforceReadOnly` | `boolean` | `true` | 是否在底层工具拦截对标记为只读目录的文件写入与编辑 |
| `defaultDirectories` | `Array` | `[]` | 启动时预先关联的静态目录列表（包含 `path`, `alias`, `description`, `readOnly`） |

### YAML 配置示例

```yaml
- id: addir
  config:
    enableTools: false           # 仅允许在 UI 界面中手动管理，禁止智能体自行增删
    enableContextInjection: true # 保持提示词注入
    enforceReadOnly: true        # 开启只读保护
    defaultDirectories:
      - path: /data/docs/specs
        alias: specs
        description: API 规范文档
        readOnly: true
```

> [!TIP]
> 界面中所做的新增、编辑和删除操作，会实时持久化在 `$DSH_HOME/storages/addir.json` 中，按规范化工作区根路径索引，无需担心重启丢失。

---

## 🛠️ 智能体工具（Agent Tools）

当 `enableTools` 开启时，智能体可自主使用以下工具：

| 工具名称 | 参数 | 说明 |
|---|---|---|
| `addir_list` | — | 查看当前工作区已关联的所有目录（包括主根目录、别名、描述与只读标记） |
| `addir_add` | `path` (必填)<br>`alias` (可选)<br>`description` (可选)<br>`readOnly` (可选) | 动态关联一个额外目录。支持传入绝对路径或相对工作区主目录的路径 |
| `addir_remove` | `pathOrAlias` (必填) | 解除关联指定目录（支持按绝对路径或别名查找，主根目录不可移除） |

如不希望智能体拥有自主挂载权限，只需将配置中的 `enableTools` 设为 `false`。

---

## 🧩 开发者 API

其他插件或扩展可以通过 Cordis 服务上下文直接调用 `ctx.addir`：

```ts
import type { Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context) {
  // 获取当前会话下关联的目录列表
  const dirs = ctx.addir.list(sessionId)

  // 动态关联额外目录
  ctx.addir.add({
    path: '/path/to/shared-lib',
    alias: 'shared',
    description: 'Shared utilities',
    readOnly: true,
  }, sessionId)

  // 解析带别名的路径为真实绝对路径（例如 '[shared]/utils.ts' -> '/path/to/shared-lib/utils.ts'）
  const resolved = ctx.addir.resolvePath('[shared]/utils.ts', sessionId)

  // 检查某个路径是否归属于当前工作区或其关联目录
  const isIncluded = ctx.addir.isUnderWorkspace('/path/to/file.ts', sessionId)

  // 检查某个路径是否处于只读保护范围内
  const isReadOnly = ctx.addir.isReadOnly('/path/to/file.ts', sessionId)
}
```

---

## ❓ 常见问题 (FAQ)

<details>
<summary><b>Q: 桌面端（Desktop）安装后没有出现「编辑」菜单？</b></summary>

桌面端应用在首次安装插件时，需要完全退出应用进程（macOS 请使用 `Cmd + Q`，Windows 请从托盘或任务管理器完全退出），再次启动应用使客户端扩展脚本加载生效。
</details>

<details>
<summary><b>Q: 标记为只读的目录，智能体还可以阅读或搜索代码吗？</b></summary>

可以。只读保护仅拦截 `write`、`edit` 等修改文件的工具调用，代码阅读（`read`）、检索（`grep` / `glob`）等完全正常运作。
</details>

<details>
<summary><b>Q: 可以在多个不同的工作区中使用相同的别名吗？</b></summary>

可以。目录关联数据是严格按照各工作区的根目录路径隔离存储的，不同工作区之间的别名互不影响。
</details>

<details>
<summary><b>Q: 如何防止智能体自作主张关联新目录？</b></summary>

在 DSH 插件设置中将 **`enableTools`** 开关关闭（或在配置文件中设为 `false`），智能体将不再拥有 `addir_*` 工具，但您依然可以在 GUI 弹窗中手动管理目录。
</details>

---

## 💻 本地开发

```sh
# 安装依赖
pnpm install

# 运行单元测试与集成测试
pnpm test

# 类型检查
pnpm run typecheck

# 构建打包（含 client bundle 语法检查与 d.ts 生成）
pnpm run build
```

> **架构提示**：客户端代码采用经典脚本与 DSH 共享模块加载器注册（`window.__ModuleLoader__.load`），使用宿主提供的 React 运行时。工作区菜单入口通过 DOM 适配器挂载（`src/client/workspace-menu.ts`）。

---

## 📄 License

本项目基于 [MIT 许可证](LICENSE) 开源。
