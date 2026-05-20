# X 黄推屏蔽

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

Chrome / Chromium 扩展：在 [X](https://x.com)（Twitter）网页版自动隐藏黄推、引流与垃圾回复，支持一键拉黑作者。

> 本扩展为 [dream-blocker](https://github.com/dreamer-35/dream-blocker) 仓库子项目。

## 功能

- 内置 + 自定义规则（关键词、域名、正则）
- 时间线 / 搜索 / 回复区实时扫描（MutationObserver）
- 命中后自动隐藏，可撤销显示
- 可选调用 X 官方 Block API 拉黑作者
- 白名单、本机统计、规则 JSON 导入导出
- 数据仅存本地，不上传第三方

## 安装

### 从源码加载（开发）

```bash
git clone https://github.com/dreamer-35/dream-blocker.git
cd dream-blocker/x-yellow-blocker
```

1. Chrome → `chrome://extensions`
2. 开启 **开发者模式**
3. **加载已解压的扩展程序** → 选择本目录（含 `manifest.json` 的文件夹）
4. 登录 [x.com](https://x.com) 并刷新时间线

### 商店安装

暂未上架 Chrome Web Store。欢迎 Star 关注后续发布。

## 使用

- 命中规则的推文会被隐藏，上方出现红色操作条
- **显示**：恢复本条
- **拉黑作者**：写入 X 官方黑名单（需已登录；先滚动时间线以便捕获 Bearer）
- **信任此人**：加入白名单
- 点击扩展图标：总开关、规则编辑、统计、导入导出

## 隐私

- 规则、白名单、统计、已拉黑 ID 保存在 `chrome.storage`（sync / local）
- 不向第三方服务器上传数据
- 拉黑请求仅发往 `x.com` 官方 API

## 误伤处理

1. 操作条点 **显示**
2. 将作者加入 popup **白名单**
3. 关闭过严的自定义规则或某类内置规则
4. **恢复默认** 重置规则

## 开发

```text
x-yellow-blocker/
├── manifest.json
├── src/shared/      # 规则与匹配
├── src/content/     # 扫描、隐藏、操作条
├── src/background/  # 拉黑队列
├── src/popup/       # 设置面板
├── styles/
└── icons/
```

修改代码后：在 `chrome://extensions` 刷新扩展，并刷新 x.com 标签页。开启 popup 中的「调试日志」可在控制台查看 `[xyb]` 输出。

## 测试清单

- [ ] 扩展加载无报错
- [ ] popup 保存后 x.com 规则生效
- [ ] 添加测试关键词 `TEST_XYB_SPAM` 可触发隐藏与操作条
- [ ] 「显示」「信任此人」行为正确
- [ ] 「拉黑作者」在 X 设置 → 已屏蔽 中可见（需登录且 Bearer 已捕获）

## 风险说明

- X 的 DOM / 内部 API 可能变更，需不定期维护选择器与鉴权逻辑
- 内置规则偏激进，建议以隐藏为主，拉黑前请确认
- 频繁拉黑可能触发限流；扩展内置 ≥800ms 请求间隔

## 许可证

MIT — 见仓库根目录 [LICENSE](../../LICENSE)。
