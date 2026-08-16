import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
}

if (!deepseekApiKey) {
  throw new Error('DEEPSEEK_API_KEY must be set in .env');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SYSTEM_PROMPT = `Ты — AI-ассистент для аналитика по антифроду в финтех-компании.
Тебе передан список транзакций одного или нескольких отправителей
за период. Твоя задача — найти транзакции, которые выглядят
подозрительно, и объяснить причину простым языком, понятным
человеку без технического бэкграунда.

Признаки подозрительной транзакции (используй как ориентир, не
ограничивайся только ими, если видишь другой явный паттерн):
- Сумма сильно отличается от типичных сумм этого отправителя
  (посмотри на его историю в переданных данных)
- Получатель не встречается в истории этого отправителя ранее
- Операция совершена в нетипичное время (ночь, 00:00–05:00)
- Несколько операций одного отправителя за короткий промежуток
  времени (минуты), особенно с суммами чуть ниже круглых значений
  (похоже на дробление для обхода лимитов)

Не помечай транзакцию подозрительной только потому, что сумма
чуть выше среднего — ищи явные отклонения, а не любые колебания.

Верни ответ СТРОГО в формате JSON, без пояснений вне JSON:

{
  "flagged": [
    {
      "id": <id транзакции>,
      "reason": "<объяснение простым языком, 1-2 предложения>",
      "risk_level": "low" | "medium" | "high"
    }
  ]
}

Если подозрительных транзакций нет — верни {"flagged": []}.`;

interface FlaggedTransaction {
  id: number | string;
  reason: string;
  risk_level: string;
}

function parseFlaggedJson(content: string): FlaggedTransaction[] {
  // Попытка прямого парсинга
  try {
    const parsed = JSON.parse(content);
    if (parsed && Array.isArray(parsed.flagged)) {
      return parsed.flagged;
    }
  } catch {
    // Игнорируем и пробуем извлечь JSON регуляркой
  }

  // Извлечение первого JSON-объекта из текста с пояснениями
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && Array.isArray(parsed.flagged)) {
        return parsed.flagged;
      }
    } catch {
      // Игнорируем — вернём пустой массив
    }
  }

  return [];
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/analyze', async (_req, res) => {
  try {
    // 1. Забираем все транзакции из Supabase
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id, transaction_date, amount, sender, receiver')
      .order('transaction_date', { ascending: false });

    if (error) {
      return res.status(500).json({
        error: 'Ошибка загрузки транзакций из Supabase',
        details: error.message,
      });
    }

    if (!transactions || transactions.length === 0) {
      return res.status(200).json({ flagged: [] });
    }

    // 2. Отправляем транзакции в DeepSeek API (system + user)
    const userContent = `Данные транзакций:\n${JSON.stringify(transactions)}`;

    const completionResponse = await fetch(
      'https://api.deepseek.com/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          stream: false,
        }),
      },
    );

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      return res.status(completionResponse.status).json({
        error: 'Ошибка DeepSeek API',
        details: errorText,
      });
    }

    const completion = await completionResponse.json();
    const content = completion?.choices?.[0]?.message?.content ?? '';

    // 3. Парсим ответ как JSON (с fallback регуляркой)
    const flagged = parseFlaggedJson(content);

    // 4. Возвращаем массив flagged
    return res.status(200).json({ flagged });
  } catch (err) {
    return res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});