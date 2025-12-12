// AI API configuration (OpenAI or Gemini)
// - Reads OPENAI_API_KEY or GEMINI_API_KEY from environment
// - Uses dotenv to load from .env file at project root if not in environment
// - Exports a plain config object
// - Gemini API takes priority if both keys are present

const path = require('path');
const fs = require('fs');

// Try to load .env from multiple possible locations
const possibleEnvPaths = [
  path.resolve(__dirname, '..', '.env'),  // ai/../.env (project root)
  path.resolve(process.cwd(), '.env'),     // current working directory
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

// Also try default dotenv behavior (looks for .env in current working directory)
if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
  require('dotenv').config();
}

let cachedConfig = null;

function getConfig() {
  if (cachedConfig) return cachedConfig;

  // Gemini API 사용 (Gemma 모델 사용)
  const geminiApiKey = process.env.GEMINI_API_KEY || null;
  
  console.log('[Config] GEMINI_API_KEY 확인:', geminiApiKey ? (geminiApiKey.substring(0, 10) + '...') : '없음');
  
  if (!geminiApiKey) {
    console.error('[Config] ❌ GEMINI_API_KEY가 설정되지 않았습니다!');
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일에 GEMINI_API_KEY를 추가해주세요.');
  }
  
  // Gemini API 사용 (Gemma 모델 포함)
  console.log('[Config] ✅ Gemini API 사용 (Gemma 모델 포함)');
  cachedConfig = {
    api_key: geminiApiKey,
    provider: 'gemini',
    base_url: 'https://generativelanguage.googleapis.com',
    api_endpoint: '/v1beta/models/gemma-3-1b-it:generateContent',
    default_model: 'gemma-3-1b-it', // Gemma 모델 사용
    api_version: 'v1beta',
    timeout: 30,
    verify_tls: true,
  };

  return cachedConfig;
}

module.exports = getConfig();



