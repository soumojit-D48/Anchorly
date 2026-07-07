import { logger } from '@anchorly/shared/logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface OpenRouterResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export async function callOpenRouter(messages: ChatMessage[]): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const model = process.env.OPENROUTER_MODEL!;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://anchorly.dev',
      'X-Title': 'Anchorly',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, body: errorBody }, 'OpenRouter API error response');
    throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
  }

  const rawBody = await response.json();

  const data = rawBody as {
    choices?: Array<{ message: { content: string } }>;
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
    error?: string;
  };

  if (data.error) {
    logger.error({ error: data.error }, 'OpenRouter returned an error in response body');
    throw new Error(`OpenRouter error: ${data.error}`);
  }

  if (!data.choices || data.choices.length === 0) {
    logger.error({ rawBody }, 'OpenRouter response has no choices');
    throw new Error('OpenRouter response has no choices');
  }

  return {
    content: data.choices[0].message.content,
    model: data.model ?? 'unknown',
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
