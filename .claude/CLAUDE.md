# math-practice 项目指南

## 项目概述

交互式数学练习 SPA，纯 HTML + JS，数据存储在 `problems.json`，部署在 GitHub Pages (`shengyue9999.github.io/math-practice/`)。

## 考题上传 workflow

将 Word (.docx) 或 PDF 试卷集成到项目中。

### 方案 A：Claude API 解析（推荐，无需手动处理图片）

```
docx/PDF → 逐页截图 → Claude API 解析 → 结构化 JSON → 写入 problems.json
```

用 PyMuPDF 逐页转图，发送给 Claude，prompt 要求返回：
```json
{
  "id": "q1",
  "type": "choice|fill|open|solve",
  "score": 5,
  "html": true,
  "question": "<p>题目文字</p><img src='...'>",
  "options": [{"label": "A", "text": "选项（可含<img>"}],
  "blanks": [{"answer": "答案", "tolerance": 0.01}],
  "answer": "A",
  "explanation": "<p>解析（可含图片、LaTeX）</p>"
}
```

**关键**：让 Claude 为几何图形生成直接可嵌入的 SVG 代码（`figure.svg` 字段），避免 WMF 转换。

### 方案 B：手动提取（当前的 Word→pandoc 流程）

1. `pandoc input.docx -t html --extract-media=media/ -o output.html`
2. 从 HTML 中提取题目结构，PNG 图片直接用
3. WMF 公式需用 `wmf2svg` 转换，然后修正 SVG 格式（见下文）
4. 将数据写入 `problems.json` 的 `"exams"` 数组

### SVG 格式修正（方案 B 必需步骤）

`wmf2svg` 生成的 SVG 有多个浏览器兼容性问题，必须修正：

1. **移除旧 DOCTYPE**：删除 `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20001102//EN" ...>`
2. **添加现代命名空间**：`<svg xmlns="http://www.w3.org/2000/svg" ...>`
3. **移除 sodipodi 命名空间**：删除 `xmlns:sodipodi="..."`
4. **转换 matrix transform**：`transform="matrix(1 0 0 1 X Y)"` → `x="X" y="Y"`
5. **Symbol 字体映射**：读取原始字节，将 Symbol 字体编码映射到 Unicode（0xb8→÷, 0xb4→×, 0xe6-0xfb→括号部件等）
6. **⚠️ 字体引号**：style 属性内必须用**单引号**包裹字体名：`font-family:'Times New Roman',Times,serif`，双引号会截断 style 属性导致 SVG 解析失败

## problems.json 结构

```json
{
  "weeks": [{ "id": "week-1", "title": "...", "problems": [...] }],
  "exams": [{ "id": "2025-haidian-g6-final", "title": "试卷名称", "problems": [...] }]
}
```

### 题型

| type | 说明 | 评分方式 |
|------|------|----------|
| `choice` | 选择题 | 单选，`answer` 为选项字母 |
| `fill` | 填空题 | `blanks[]` 逐个比对，支持 `tolerance` |
| `solve` | 解决问题 | 按最终结果判对错，过程在解析中展示 |
| `open` | 开放题 | 不自动评分，textarea 作答，交卷后展示解析 |

### 关键字段

- `html: true` — 题目含 HTML（图片、表格），渲染时不转义
- `blanks[].tolerance` — 数值答案容差（如 0.01 表示精确到两位小数）
- `blanks[].answer` — 多个可接受答案用 `|` 分隔
- 图片路径相对于项目根，如 `exams/2025海淀六下期末/media/image1.png`

## 页面架构

- `index.html`：单文件 SPA，包含 CSS + JS
- `problems.json`：所有题目数据
- `exams/` 目录：试卷媒体文件
- 视图切换：`renderHome()` → `renderQuiz()` → `submitQuiz()` → `revealAnswers()`
- 考试入口：首页 "模拟考试" 区域，调用 `startExam(examId)`
- 错题本：`localStorage` 存储，搜索 `weeks` + `exams`

## 部署

项目同时部署到两个平台，`git push` 后自动触发：

### GitHub Pages

`shengyue9999.github.io/math-practice/`，由 GitHub Actions 自动部署。

### Cloudflare Pages（主用域名）

自定义域名 `math-practice.sheng-1980.cc`，由 Cloudflare Pages 监听 GitHub 仓库自动部署。

**关键配置文件：**

- `wrangler.jsonc` — 声明 `pages_build_output_dir: "."`、`nodejs_compat`、observability
- `functions/api/review.js` — AI 批改 API（Pages Function），通过 `env.OPENROUTER_API_KEY` 读取密钥

**Cloudflare Dashboard 设置（必须检查）：**
- Build command：**留空**（不要填 `npx wrangler deploy`，那是 Worker 命令）
- Build output directory：`.`
- Root directory：留空

**密钥管理：**
API 密钥不写入代码，通过 Cloudflare Dashboard → Workers & Pages → math-practice → Settings → Variables & Secrets 设置：
- `OPENROUTER_API_KEY`：OpenRouter API 密钥（用于 AI 批改）

本地开发时可用 `wrangler pages secret put OPENROUTER_API_KEY` 同步。

**部署流程：**
```bash
git add . && git commit -m "..." && git push
# Cloudflare Pages 自动部署，约 1-2 分钟生效
# GitHub Pages 同步自动部署
```

**验证：**
```bash
# 检查 AI 批改功能
curl -s -X POST https://math-practice.sheng-1980.cc/api/review \
  -H "Content-Type: application/json" \
  -d '{"question":"1+1","studentAnswer":"2","correctAnswer":"2"}'
```

**硬刷新（用户端）：**
- Safari: Cmd+Option+R
- Chrome: Cmd+Shift+R

## 已知坑位

- WMF 文件无法被浏览器直接使用，必须转 SVG 或 PNG
- `wmf2svg` 输出的 SVG 是 2000 年 DTD 格式，不修正浏览器无法渲染
- Symbol 字体的非 UTF-8 字节会导致 Python 解码崩溃，需在字节层处理
- GitHub Pages 缓存较激进（`max-age=600`），更新后可能需等 10 分钟
- Safari 硬刷新是 Cmd+Option+R（非 Shift）
- Cloudflare Pages 的 Build command 必须留空，填 `npx wrangler deploy`（Worker 命令）会导致构建失败
- Cloudflare Pages 自定义域名如果和 Pages 项目不在同一个 Cloudflare 账号下，无法通过 CLI 管理密钥和域名
- `wrangler.jsonc` 中 `pages_build_output_dir` 和 `assets` 不能同时存在
