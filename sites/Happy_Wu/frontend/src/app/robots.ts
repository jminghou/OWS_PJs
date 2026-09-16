import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/siteConfig';

// 不開放爬取的私有 / 交易路徑
const disallow = ['/admin/', '/api/', '/order/', '/mock-payment/'];

// 主流 AI / 答案引擎 (AEO) 爬蟲 —— 明確邀請它們收錄，以利被 AI 引用
const aiBots = [
  'GPTBot', // OpenAI 訓練爬蟲
  'OAI-SearchBot', // ChatGPT 搜尋
  'ChatGPT-User', // ChatGPT 即時瀏覽
  'ClaudeBot', // Anthropic 訓練爬蟲
  'anthropic-ai',
  'Claude-Web',
  'PerplexityBot', // Perplexity 索引
  'Perplexity-User',
  'Google-Extended', // Gemini / Vertex
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl（多數 LLM 的資料來源）
  'cohere-ai',
  'Meta-ExternalAgent', // Meta AI
  'Amazonbot',
  'DuckAssistBot',
  'YouBot',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: aiBots, allow: '/', disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
