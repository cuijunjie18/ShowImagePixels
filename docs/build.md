# 从源码构建 ShowImagePixels

本文档指导你如何从源码编译并打包 ShowImagePixels VS Code 扩展为 `.vsix` 文件。

## 前置条件

- [Node.js](https://nodejs.org/) >= 18.x
- [npm](https://www.npmjs.com/) >= 9.x（随 Node.js 一起安装）
- [Visual Studio Code](https://code.visualstudio.com/) >= 1.110.0

## 步骤

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd showimagepixels
```

### 2. 安装依赖

```bash
npm install
```

### 3. 安装打包工具

`@vscode/vsce` 是 VS Code 官方提供的扩展打包/发布工具：

```bash
npm install -g @vscode/vsce
```

### 4. 编译 TypeScript

```bash
npm run compile
```

编译成功后，`out/` 目录下会生成对应的 `.js` 文件。

### 5. 打包为 VSIX

```bash
npm run package
```

或者直接运行：

```bash
vsce package --no-dependencies
```

打包成功后，项目根目录下会生成 `showimagepixels-0.0.1.vsix` 文件。

> **注意**：`--no-dependencies` 参数表示不打包 `node_modules` 中的依赖。本项目运行时无需任何第三方依赖，因此可以安全使用此参数。

### 6. 本地安装 VSIX

有以下几种方式安装生成的 `.vsix` 文件：

#### 方式一：通过 VS Code 命令面板

1. 打开 VS Code
2. 按 `Ctrl+Shift+P`（macOS: `Cmd+Shift+P`）
3. 输入 `Extensions: Install from VSIX...`
4. 选择生成的 `.vsix` 文件

#### 方式二：通过命令行

```bash
code --install-extension showimagepixels-0.0.1.vsix
```

### 7. 验证安装

1. 打开 VS Code 资源管理器
2. 右键点击任意图片文件（如 `.png`、`.jpg` 等）
3. 在上下文菜单中应能看到 **ShowPixels** 选项
4. 点击后会在右下角通知栏显示图片的像素尺寸

## 项目结构

```
showimagepixels/
├── src/
│   └── extension.ts    # 扩展主入口，包含图片尺寸解析逻辑
├── out/                 # TypeScript 编译输出目录
├── package.json         # 扩展清单和项目配置
├── tsconfig.json        # TypeScript 编译配置
├── .vscodeignore        # 打包时排除的文件列表
├── README.md            # 项目介绍
└── build.md             # 本文档
```

## 常见问题

### Q: 打包时提示 `Missing publisher name`

确保 `package.json` 中包含 `"publisher"` 字段。本地使用可以设置为任意值，例如 `"local-dev"`。

### Q: 编译报错 TypeScript 类型错误

确保使用了正确的 Node.js 和 TypeScript 版本：

```bash
node --version   # >= 18.x
npx tsc --version  # >= 5.x
```

### Q: 安装后右键菜单没有 ShowPixels 选项

确认右键点击的是支持的图片格式文件（`.png`、`.jpg`、`.jpeg`、`.gif`、`.bmp`、`.webp`、`.ico`、`.tiff`、`.tif`、`.svg`、`.avif`）。
