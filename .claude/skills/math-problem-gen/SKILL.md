---
name: math-problem-gen
description: >
  Generates 6th-grade (六年级) math practice problems based on a knowledge point taxonomy
  extracted from real exam papers. Use when the user asks to "generate math problems",
  "出题", "生成题目", "组卷", "出卷子", "针对性练习", or wants to create new
  problems targeting specific knowledge points or weak areas. Also use when the user
  mentions "错题" (wrong answers) analysis for targeted practice, or wants to build a
  complete exam paper. This skill handles the full pipeline: scan for new inputs,
  generate problems with independent verification, and output in the project's
  problems.json format.
argument-hint: <知识点|题型|数量> [难度] [输出模式：练习/试卷]
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, WebSearch]
---

# 数学出题 Skill

## 概述

此 Skill 为 math-practice 项目生成六年级下学期数学题目。核心能力：
1. **增量扫描**：检测新试卷、教师笔记、错题数据
2. **知识点出题**：基于知识体系生成新题目
3. **独立验算**：生成后用 Python 独立验证答案
4. **结构化输出**：输出符合 `problems.json` schema 的 JSON

## 项目文件路径

| 文件 | 路径 | 用途 |
|------|------|------|
| problems.json | `problems.json` | 所有题目数据 |
| knowledge-points.json | `knowledge-points.json` | 知识点体系 |
| teacher-notes.md | `teacher-notes.md` | 教师注意事项 |
| 试卷输入目录 | `~/Downloads/math-exams/` | 新试卷投放处 |
| 错题导出 | `data/` | 用户错题本 JSON |
| 媒体资源 | `exams/{试卷名}/media/` | 题目图片 |

## 工作流程

### 第零步：增量扫描（每次触发必做）

在生成题目之前，检查以下三个输入源是否有更新：

```
1. ~/Downloads/math-exams/ 中是否有新试卷文件
   → 对比 problems.json 中已有的 exam ID，找出新增文件
   → 如有新试卷，提醒用户需要先炼化（见 CLAUDE.md 方案 A/B/C）
   
2. teacher-notes.md 是否有更新
   → 读取最新内容，关注新增的易错点和注意事项
   → 出题时在相关知识点上应用这些提醒
   
3. data/ 目录是否有新的错题导出
   → 读取 *.json 文件中的 wrongBook 数据
   → 分析高频错误知识点，用于针对性出题
```

### 第一步：理解出题需求

从用户输入中提取：
- **知识点**：要覆盖哪些知识点？（查看 `knowledge-points.json` 中的 domains/topics）
- **题型**：choice（选择）、fill（填空）、solve（解决问题）、open（开放题）
- **数量**：生成几道题？
- **难度**：1=基础计算, 2=应用, 3=综合
- **输出模式**：练习模式（追加到 weeks）还是试卷模式（生成完整 exam）
- **针对性**：是否基于错题数据针对薄弱点？

如果不清楚，主动询问用户。

### 第二步：参考样题

从 `problems.json` 中找到同知识点的现有题目作为参考：
- 读取 `knowledge-points.json` → 找到对应 topic → 查看 `sampleProblems`
- 读取样题的完整 JSON，理解该知识点的出题风格、数字范围、场景设置

### 第三步：生成新题

基于样题风格生成新题目，核心原则：
- **换数字**：保持结构，更换具体数值
- **换场景**：保持知识点，更换生活场景
- **换数据**：统计图表题更换数据但保持题型结构
- **加陷阱**：参考 `teacher-notes.md` 中的常见错误，在干扰项中设置典型错误选项
- **保格式**：严格遵守 `problems.json` 中各题型的 JSON schema

#### 各题型 schema 要求

**选择题 (choice)**：
```json
{
  "id": "qN", "type": "choice", "score": N,
  "html": true,  // 如有图片或表格
  "question": "题目文字，可含<br>和<img src='...'>",
  "options": [
    {"label": "A", "text": "选项文字"},
    {"label": "B", "text": "选项文字"},
    {"label": "C", "text": "选项文字"},
    {"label": "D", "text": "选项文字"}
  ],
  "answer": "A",
  "explanation": "解析，说明解题步骤"
}
```

**填空题 (fill)**：
```json
{
  "id": "qN", "type": "fill", "score": N,
  "question": "题目中的空用_______表示",
  "blanks": [
    {"answer": "答案1", "size": 5},
    {"answer": "答案2|备选答案", "size": 8, "tolerance": 0.01, "suffix": " 单位"}
  ],
  "explanation": "解析"
}
```
- `size`：输入框宽度（字符数）
- `tolerance`：数值答案的容差（可选）
- `suffix`：填空后的单位文字（可选）
- 多个可接受答案用 `|` 分隔

**解决问题 (solve)**：
```json
{
  "id": "qN", "type": "solve", "score": N,
  "reviewable": true,  // 可选，启用 AI 批改
  "question": "题目文字",
  "blanks": [{"answer": "最终答案", "size": 8, "suffix": " 单位"}],
  "explanation": "详细解题过程"
}
```

**开放题 (open)**：
```json
{
  "id": "qN", "type": "open", "score": N,
  "html": true,
  "question": "题目文字，通常含图片",
  "explanation": "参考答案或评分标准"
}
```

### 第四步：验算（必须执行！）

**每道题生成后必须独立验算，验算不通过就修正后重新验算。**

#### 4.1 计算验证
用 Python 独立计算答案（不使用生成时的逻辑）：
```python
# 示例：验证一道百分数应用题
# 题目：原价 x 元，打八折后比原价少 30 元，求 x
# 生成答案：150
# 验证：
x = 150
discount = x * 0.8  # 120
saving = x - discount  # 30
assert saving == 30, f"Expected 30, got {saving}"
# 验证通过 ✓
```

#### 4.2 选择题检查
- 正确选项必须唯一
- 每个干扰项必须确实错误（不能用"都有可能"）
- 检查典型错误答案是否在干扰项中（参考 teacher-notes.md）

#### 4.3 填空题检查
- 答案数值是否在合理范围内
- 单位是否正确
- 如果有 tolerance，确认精度合理

#### 4.4 常识检查
- 场景数据是否合理（如教室长度约8米而非80米）
- 百分数、折扣在合理范围（0%-100%，特殊情况可超）
- 几何尺寸符合实际

#### 4.5 教师笔记交叉检查
- 如果 teacher-notes.md 提到该知识点的易错点，确认题目没有引入歧义
- 确认正确解法没有被某个"看起来对"的错误思路推翻

### 第五步：输出

#### 练习模式（单题或多题）
输出 JSON 数组，可直接追加到 `problems.json` 的 `weeks` 数组中。
告知用户可以直接使用，或指定追加到哪个 week。

#### 试卷模式
输出完整 exam 结构：
```json
{
  "id": "custom-{topic}-{date}",
  "title": "自定义试卷标题",
  "subtitle": "共N题 · 满分M分",
  "problems": [...]
}
```

---

## 快速参考：六年级下知识点体系

### 数与代数
- 负数与相反数、绝对值、数轴
- 比例与比例尺、解比例
- 百分数、成数、折扣
- 正比例与反比例
- 用字母表示数、简易方程

### 图形与几何
- 圆柱与圆锥（体积、表面积）
- 三角形（面积、三边关系、等腰三角形判定）
- 图形的放大与缩小（比例尺与面积比）
- 几何体三视图与展开图
- 梯形面积

### 统计与概率
- 统计图表的阅读与分析（条形、折线、扇形）
- 可能性与概率
- 抽样调查 vs 全面调查
- 平均数

### 综合与实践
- 鸽巢原理（抽屉原理）
- 数学广角（古代数学问题、哈沙德数等新定义数）
- 大数读写与改写
- 单位换算

---

## 验算脚本模板

每次生成题目后，创建并运行以下结构的验证脚本：

```python
# verify_generated_problems.py
# 独立于生成逻辑的验证

problems = [...generated problems JSON...]

for p in problems:
    pid = p['id']
    ptype = p['type']
    
    if ptype == 'choice':
        ans = p['answer']
        # 1. 验证正确选项确实正确
        # 2. 验证每个干扰项确实错误
        # 3. 验证只有一个正确答案
        print(f"[{pid}] Choice verification: PASS")
    
    elif ptype in ('fill', 'solve'):
        for bi, blank in enumerate(p['blanks']):
            expected = blank['answer'].split('|')[0]  # 主答案
            # 1. 用 Python 独立计算
            # 2. 对比生成答案
            # 3. 检查 tolerance
            print(f"[{pid}] Blank {bi} verification: PASS")
    
    elif ptype == 'open':
        print(f"[{pid}] Open-ended: manual review required")

print("\nAll verifications passed!")
```

---

## 注意事项

1. **不重复**：检查生成的题目是否与已有题目高度重复（换数字但结构完全不同不算重复）
2. **难度匹配**：六年级下学期的题目难度，不要超纲
3. **语言自然**：题目表述符合小学六年级学生的阅读水平
4. **图片处理**：如需几何图形，使用 SVG 或提醒用户提供截图
5. **分数表示**：填空题同时接受小数、分数、带分数（用 `|` 分隔）
6. **容差设置**：涉及 π 的计算结果设置 `tolerance: 0.01`
