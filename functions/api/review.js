export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const { question, studentAnswer, correctAnswer, explanation, questionNumber } = await request.json();

    if (!question || !studentAnswer || !correctAnswer) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const prompt = `你是一位小学数学老师，正在批改一道解答题的解题过程。

题目：${question}

标准答案：${correctAnswer}
题目解析：${explanation || '无'}

学生作答内容：
${studentAnswer}

请评价学生的解题过程：
1. 如果学生写出了完整过程：分析思路是否正确，哪一步有错误，指出错误原因
2. 如果学生只写了最终答案：引导孩子写出完整的解题过程
3. 如果学生写对了：肯定和鼓励

要求：
- 语气亲切温和，像老师在和孩子对话
- 控制在100字以内
- 如果是结果对了但过程中有错误，要指出来
- 用"你"来称呼`;

    const openrouterKey = env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'https://math-practice.sheng-1980.cc',
        'X-Title': 'Math Practice AI Review',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat-v3-0324',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenRouter error:', data.error);
      return new Response(JSON.stringify({ error: data.error.message || 'AI service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const review = data.choices?.[0]?.message?.content || '批改暂时不可用，请稍后再试。';

    return new Response(JSON.stringify({ reviewText: review }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (e) {
    console.error('Review error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
