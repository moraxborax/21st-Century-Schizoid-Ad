# 21st Century Schizoid Ad

跳过 B 站 UP 主插入的视频内广告（如口播、贴片等）

## 功能特点

- 📌 **社区驱动**：基于 [Epitaph](https://github.com/moraxborax/epitaph) ([Epitaph备份](epitaph/)) 数据源，支持社区提交和共享广告时间段
- ⚡ **轻量快速**：纯前端实现，无后台服务，不收集任何用户数据
- 🎯 **精准跳过**：毫秒级检测，支持多种广告类型（硬广/软广/口播等）
- ⚙️ **灵活配置**：可自定义不同广告类型的处理方式（跳过/询问/忽略）
- 🌐 **扩展性强**：可以自己修改epitaph。甚至之后可以加入AI识别。

## 安装方法

1. 下载本仓库代码
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择本仓库目录

## 使用方法

1. 访问 B 站视频页面（如 `https://www.bilibili.com/video/BV1JDMQzUEwy`）
2. 当播放到已知广告片段时，扩展会显示提示
3. 点击「跳跃吧！绯红之王」可立即跳转到广告结束位置

## 配置选项

右键点击扩展图标 → 选项，可以设置：

- 启用/禁用扩展
- 不同广告类型的处理方式：
  - 硬广（hard_ad）
  - 软广（soft_ad）
  - 赞助口播（sponsor_segment）
  - 产品展示（product_showcase）
  - 自我宣传（self_promo）
- 内容价值阈值（低于此值自动跳过）

## 贡献广告数据

1. 在 [Epitaph仓库](https://github.com/moraxborax/epitaph) 或 [Epitaph目录](epitaph/) 下找到对应视频的 JSON 文件
2. 按格式添加广告时间段，例如：
   ```json
   {
     "start": 90,
     "end": 96,
     "type": "soft_ad",
     "confidence": 0.9,
     "content_value": 0.6,
     "disruptiveness": 0.4,
     "product_name": "产品名称",
     "product_category": "产品类别"
   }
   ```
3. 提交 Pull Request

## 已知问题

- 仅支持 www.bilibili.com 的视频播放页
- 需要手动刷新页面才能应用配置更改
- 本插件**大量使用AI工具[Windsurf](https://windsurf.com/)**，请谨慎使用。如果想要重现可以直接基于[plan.md](/plan.md)用AI工具生成。

## 许可证

MIT
