# Screen Cut

一个功能强大的 macOS 截图管理命令行工具，具有组织、备份和清理截图文件的功能。

## 功能特性

- **截图管理**
  - 自动检测和管理多个目录中的截图
  - 支持多种截图命名模式
  - 文件组织和分类

- **备份系统**
  - 自动备份已删除的截图
  - 可配置的备份保留期（默认：30天）
  - 最大备份集限制（默认：10个）

- **缓存管理**
  - 智能缓存系统，提升操作速度
  - 自动清理缓存（超过7天的文件）
  - 缓存大小限制管理（默认：1GB）

- **清理系统**
  - 自动清理旧的缓存文件和备份
  - 通过定期压缩优化数据库
  - 可配置的清理间隔

## 安装

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/screen-cut.git
cd screen-cut
```

2. 安装依赖：
```bash
pnpm install
```

3. 构建项目：
```bash
pnpm run build
```

## 使用方法

### 基本命令

1. **列出截图**
```bash
node dist/index.js list
```

2. **删除截图**
```bash
node dist/index.js delete [选项]
```
选项：
- `-p, --path <path>`：指定要删除的截图路径
- `-a, --all`：删除所有截图
- `-f, --force`：跳过确认

3. **清理**
```bash
node dist/index.js cleanup [选项]
```
选项：
- `-f, --force`：强制清理，忽略上次清理时间

### 配置

默认配置可以在 `src/config/index.ts` 中找到。主要设置包括：

- 截图目录
- 缓存和备份保留期
- 截图检测的文件模式
- 数据库设置

## 开发

1. **设置开发环境**
```bash
pnpm install
```

2. **监视模式**
```bash
pnpm run dev
```

3. **构建**
```bash
pnpm run build
```

4. **运行测试**
```bash
pnpm test
```

## 项目结构

```
screen-cut/
├── src/
│   ├── commands/       # 命令实现
│   ├── config/         # 配置文件
│   ├── utils/          # 工具函数
│   └── index.ts        # 主入口点
├── dist/               # 编译后的JavaScript文件
├── tests/              # 测试文件
└── package.json        # 项目依赖和脚本
```

## 技术栈

- TypeScript
- Node.js
- SQLite (用于数据存储)
- Commander.js (用于CLI界面)
- fs/promises (用于文件系统操作)

## 贡献

欢迎提交 Pull Requests 和 Issues！在提交之前，请确保：

1. 代码已经过测试
2. 遵循现有的代码风格
3. 更新了相关文档

## 许可证

本项目采用 MIT 许可证 - 详见 LICENSE 文件
