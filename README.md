# 数学练习小工具

地址：https://shengyue9999.github.io/math-practice/

## 功能

- **周次练习** — 选择题目周次进入答题，提交后自动评分
- **错题本** — 做错的题自动收集，支持重练，答对自动移除
- **计时追踪** — 每题用时记录，超过平均时间 2 倍的题标 🐢，方便定位卡点
- **重新开始** — 误提交后可一键清空重做
- **导出数据** — 首页底部「📥 导出数据」，下载 JSON 文件，包含完整错题+用时+历史

## 添加新题目

1. 编辑 `problems.json`，在 `"weeks"` 数组里新增一周：
```json
{
  "id": "week6",
  "title": "第六周（5.18-5.22）",
  "subtitle": "共X题 · 满分XX分",
  "problems": [ ... ]
}
```

2. 题目格式参考已有题目，支持三种类型：
   - `choice` — 选择题（options + answer）
   - `fill` — 填空题（blanks）
   - `solve` — 解答题（blanks + suffix）

3. 提交推送：
```bash
cd ~/math-practice
git add problems.json
git commit -m "新增第六周题目"
git push
```

## 导出 → AI 分析 → 出题

1. 孩子做完题后，在首页点「📥 导出数据」，得到一个 JSON 文件
2. 把 JSON 文件内容发给 Claude，分析薄弱知识点
3. Claude 会生成针对性新题，按格式贴进 `problems.json`
4. Push 后孩子刷新即见新题

## 数据存储

- 答题数据存在浏览器 localStorage 中（同一设备刷新不丢）
- 导出 JSON 可备份到 `data/` 目录，commit push 后可跨设备恢复
- 换设备时用「📤 导入数据」选择之前导出的 JSON 即可恢复
