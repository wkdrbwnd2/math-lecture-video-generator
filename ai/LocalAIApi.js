// Node.js equivalent of ai/LocalAIApi.php
// Provides the same high-level API:
//   LocalAIApi.createResponse(payload, options?)
//   LocalAIApi.create_response(payload, options?) // alias
//   LocalAIApi.request(path?, payload?, options?)
//   LocalAIApi.awaitResponse(aiRequestId, options?)
//   LocalAIApi.fetchStatus(aiRequestId, options?)
//   LocalAIApi.extractText(response)
//   LocalAIApi.decodeJsonFromResponse(response)

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const config = require('./config');

class LocalAIApi {
  // 사용 가능한 모델 캐시
  static _availableModels = null;
  static _modelsCacheTime = null;
  static _modelsCacheTimeout = 3600000; // 1시간 캐시
  
  // 성공한 모델 추적 (모델명 -> 성공 횟수)
  static _successfulModels = new Map();
  
  // 할당량 초과(429)로 실패한 모델 추적 (모델명 -> 실패 횟수)
  static _quotaExceededModels = new Map();

  // ListModels API를 호출하여 사용 가능한 모델 확인
  static async listAvailableModels(apiVersion = 'v1beta') {
    const cfg = config;
    const apiKey = cfg.api_key;
    
    if (!apiKey) {
      return { success: false, error: 'api_key_missing' };
    }
    
    const url = `${cfg.base_url}/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
    console.log('[LocalAIApi] ListModels API 호출:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    
    try {
      // sendFetch를 사용하여 타임아웃 처리
      const result = await this.sendFetch(url, 'GET', null, [['Content-Type', 'application/json']], 10, true);
      
      if (!result.success) {
        console.error('[LocalAIApi] ❌ ListModels API 호출 실패:', result.error);
        console.error('[LocalAIApi] 응답 상태:', result.status);
        console.error('[LocalAIApi] 응답 데이터:', result.response);
        
        // API 버전 문제일 수 있음 - 다른 버전 시도
        if (apiVersion === 'v1beta' && result.status === 404) {
          console.log('[LocalAIApi] v1beta 실패, v1 시도...');
          const v1Result = await this.sendFetch(
            `${cfg.base_url}/v1/models?key=${encodeURIComponent(apiKey)}`,
            'GET',
            null,
            [['Content-Type', 'application/json']],
            10,
            true
          );
          if (v1Result.success) {
            console.log('[LocalAIApi] ✅ v1 API 성공');
            return v1Result;
          }
        }
        
        return result;
      }
      
      const data = result.data || result;
      if (data.models && Array.isArray(data.models)) {
        const availableModels = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => {
            // "models/gemini-1.5-flash" -> "gemini-1.5-flash"
            const name = m.name || '';
            return name.replace(/^models\//, '');
          })
          .filter(name => name.length > 0);
          // Gemma 모델 포함 (필터링 제거)
        
        // gemini-2.5-flash 계열 모델 확인 및 상세 정보 출력 (할당량 있음)
        const gemini25Flash = availableModels.filter(m => 
          m.includes('gemini-2.5-flash') || m.includes('gemini-2.0-flash') || m.includes('gemini-2.0')
        );
        if (gemini25Flash.length > 0) {
          console.log('[LocalAIApi] ✅ gemini-2.5-flash 계열 모델 발견:', gemini25Flash);
          // 각 모델의 상세 정보 출력
          gemini25Flash.forEach(modelName => {
            const modelInfo = data.models.find(m => (m.name || '').replace(/^models\//, '') === modelName);
            if (modelInfo) {
              console.log(`  - ${modelName}:`, {
                name: modelInfo.name,
                displayName: modelInfo.displayName,
                supportedMethods: modelInfo.supportedGenerationMethods
              });
            }
          });
        } else {
          console.log('[LocalAIApi] ⚠️ gemini-2.5-flash 계열 모델이 없습니다.');
          console.log('[LocalAIApi] 사용 가능한 모든 모델:', availableModels);
        }
        
        console.log('[LocalAIApi] 사용 가능한 모델 목록 (총 ' + availableModels.length + '개):', availableModels);
        return { success: true, models: availableModels };
      }
      console.warn('[LocalAIApi] ListModels 응답에 models가 없음:', data);
      return { success: false, error: 'no_models_found', data };
    } catch (error) {
      console.error('[LocalAIApi] ListModels 오류:', error.message);
      return { success: false, error: error.message };
    }
  }

  static async createResponse(params, options = {}) {
    const payload = { ...params };

    if (!Array.isArray(payload.input) || payload.input.length === 0) {
      return {
        success: false,
        error: 'input_missing',
        message: 'Parameter "input" is required and must be an array.',
      };
    }

    const cfg = config;
    
    // OpenAI API 사용
    if (cfg.provider === 'openai') {
      console.log('[LocalAIApi] OpenAI API 사용');
      const model = payload.model || cfg.default_model || 'gpt-4o-mini';
      console.log('[LocalAIApi] 요청 모델:', model);
      
      const result = await this.requestOpenAI(payload.input, model, options);
      
      if (result.success) {
        this.recordSuccessfulModel(model);
      }
      
      return result;
    }
    
    // Gemini API 사용 (fallback)
    const apiVersion = 'v1beta';
    
    // 사용 가능한 모델 확인 (캐시 사용, 하지만 항상 최신 정보 확인)
    const now = Date.now();
    const shouldRefreshCache = !this._availableModels || !this._modelsCacheTime || (now - this._modelsCacheTime) > this._modelsCacheTimeout;
    
    if (shouldRefreshCache) {
      console.log('[LocalAIApi] 사용 가능한 모델 목록 확인 중...');
      const modelsResult = await this.listAvailableModels(apiVersion);
      if (modelsResult.success && modelsResult.models && modelsResult.models.length > 0) {
        this._availableModels = modelsResult.models;
        this._modelsCacheTime = now;
        console.log('[LocalAIApi] ✅ 사용 가능한 모델 확인 완료 (총 ' + this._availableModels.length + '개)');
        // 성공한 모델 리스트 출력
        if (this._successfulModels.size > 0) {
          this.printSuccessfulModels();
        }
      } else {
        // ListModels 실패 시 기본 모델 사용 (gemma-3-1b-it 우선)
        console.warn('[LocalAIApi] ⚠️ ListModels 실패, 기본 모델 사용');
        console.warn('[LocalAIApi] ListModels 오류:', modelsResult.error);
        this._availableModels = [
          'gemma-3-1b-it',              // Gemma 모델 최우선
          'gemini-2.5-flash-lite',
          'gemini-2.5-flash',
          'gemini-2.5-flash-tts',
          'gemini-2.0-flash-exp',
          'gemini-2.0-flash',
          'gemini-2.0-flash-thinking-exp-001',
          'gemini-1.5-flash',
          'gemini-1.5-pro'
        ];
        this._modelsCacheTime = now;
      }
    } else {
      console.log('[LocalAIApi] 캐시된 모델 목록 사용:', this._availableModels.length + '개 모델');
    }
    
    // 성공한 모델 우선순위 정렬 (Gemma 모델 우선)
    const prioritizedModels = this.getPrioritizedModels(this._availableModels);
    
    // Gemma 모델이 실제로 존재하는지 확인하고 우선 사용
    const gemmaModels = prioritizedModels.filter(m => 
      m.toLowerCase().includes('gemma')
    );
    
    // gemma-3-1b-it를 최우선으로 정렬
    gemmaModels.sort((a, b) => {
      if (a.includes('gemma-3-1b-it')) return -1;  // gemma-3-1b-it 최우선
      if (b.includes('gemma-3-1b-it')) return 1;
      return 0;
    });
    
    // 첫 번째 시도 (Gemma 모델 우선, 없으면 우선순위 모델)
    let model = payload.model || cfg.default_model;
    
    // 요청된 모델이 실제로 존재하는지 확인
    const modelExists = prioritizedModels.includes(model);
    console.log('[LocalAIApi] 요청된 모델:', model, modelExists ? '(존재함)' : '(존재하지 않음)');
    
    if (!modelExists || (gemmaModels.length > 0 && !gemmaModels.includes(model))) {
      if (gemmaModels.length > 0) {
        // Gemma 모델이 있으면 우선 사용
        model = gemmaModels[0];
        console.log('[LocalAIApi] ✅ Gemma 모델 우선 사용:', model);
      } else {
        // 없으면 우선순위가 높은 모델 사용
        if (prioritizedModels.length > 0) {
          model = prioritizedModels[0];
          console.log('[LocalAIApi] 우선순위 모델 사용:', model);
        } else {
          console.error('[LocalAIApi] ❌ 사용 가능한 모델이 없습니다!');
          return {
            success: false,
            error: 'no_available_models',
            message: '사용 가능한 모델이 없습니다. ListModels API를 확인하세요.'
          };
        }
      }
    }
    
    console.log('[LocalAIApi] 첫 번째 시도 모델:', model, '(API 버전:', apiVersion + ')');
    let result = await this.requestGemini(payload.input, model, options, apiVersion);
    
    // 성공한 경우 추적
    if (result.success) {
      this.recordSuccessfulModel(model);
    }
    
    // 실패한 경우 다른 모델들 시도 (404는 건너뛰고, 429는 계속 시도)
    if (!result.success && (result.status === 404 || result.status === 429)) {
      const initialStatus = result.status;
      console.log('[LocalAIApi] 오류 발생, 다른 모델 시도:', prioritizedModels);
      
      // Gemma 모델을 먼저 시도 (아직 시도하지 않은 경우)
      const gemmaToTry = prioritizedModels.filter(m => 
        m.toLowerCase().includes('gemma') && m !== model
      );
      
      // Gemma 모델 먼저 시도
      for (const fallbackModel of gemmaToTry) {
        console.log('[LocalAIApi] Gemma 모델 시도:', fallbackModel);
        result = await this.requestGemini(payload.input, fallbackModel, options, apiVersion);
        if (result.success) {
          console.log('[LocalAIApi] ✅ Gemma 모델 성공:', fallbackModel);
          this.recordSuccessfulModel(fallbackModel);
          return result;
        } else if (result.status === 404) {
          console.log(`[LocalAIApi] 모델 ${fallbackModel}는 존재하지 않음 (404), 다음 모델 시도`);
          continue;
        } else if (result.status !== 429 && result.status !== 404) {
          console.log(`[LocalAIApi] 다른 종류의 오류 발생 (${result.status}), 다음 모델 시도`);
          continue;
        }
        // 429 오류는 계속 다음 모델 시도
      }
      
      // 나머지 모델 시도
      for (let i = 0; i < prioritizedModels.length; i++) {
        const fallbackModel = prioritizedModels[i];
        
        // 이미 시도한 모델이나 Gemma 모델은 건너뛰기
        if (fallbackModel === model || gemmaToTry.includes(fallbackModel)) {
          continue;
        }
        
        console.log('[LocalAIApi] 대체 모델 시도:', fallbackModel);
        result = await this.requestGemini(payload.input, fallbackModel, options, apiVersion);
        if (result.success) {
          console.log('[LocalAIApi] 대체 모델 성공:', fallbackModel);
          this.recordSuccessfulModel(fallbackModel);
          break;
        } else if (result.status === 404) {
          // 404는 모델이 없으므로 다음 모델 시도
          console.log(`[LocalAIApi] 모델 ${fallbackModel}는 존재하지 않음 (404), 다음 모델 시도`);
          continue;
        } else if (result.status !== 429 && result.status !== 404) {
          // 429나 404가 아닌 다른 오류면 중단
          console.log(`[LocalAIApi] 다른 종류의 오류 발생 (${result.status}), 중단`);
          break;
        }
        // 429 오류는 계속 다음 모델 시도 (할당량 문제가 아닐 수 있으므로)
      }
    }
    
    return result;
  }

  static async create_response(params, options = {}) {
    return this.createResponse(params, options);
  }

  // 성공한 모델 기록
  static recordSuccessfulModel(model) {
    if (!model) return;
    const count = (this._successfulModels.get(model) || 0) + 1;
    this._successfulModels.set(model, count);
    console.log(`[LocalAIApi] ✅ 모델 성공 기록: ${model} (${count}회 성공)`);
    this.printSuccessfulModels();
  }

  // 할당량 초과 모델 기록
  static recordQuotaExceededModel(model) {
    if (!model) return;
    const count = (this._quotaExceededModels.get(model) || 0) + 1;
    this._quotaExceededModels.set(model, count);
    console.log(`[LocalAIApi] ⚠️ 할당량 초과 모델 기록: ${model} (${count}회 실패)`);
    this.printQuotaExceededModels();
  }

  // 할당량 초과 모델 리스트 출력
  static printQuotaExceededModels() {
    if (this._quotaExceededModels.size === 0) {
      return;
    }
    
    const sorted = Array.from(this._quotaExceededModels.entries())
      .sort((a, b) => b[1] - a[1]); // 실패 횟수 내림차순
    
    console.log('\n========== 할당량 초과 모델 리스트 ==========');
    sorted.forEach(([model, count]) => {
      console.log(`  ⚠️ ${model}: ${count}회 할당량 초과`);
    });
    console.log('==========================================\n');
  }

  // 성공한 모델 리스트 출력
  static printSuccessfulModels() {
    if (this._successfulModels.size === 0) {
      console.log('[LocalAIApi] 성공한 모델이 아직 없습니다.');
      return;
    }
    
    const sorted = Array.from(this._successfulModels.entries())
      .sort((a, b) => b[1] - a[1]); // 성공 횟수 내림차순
    
    console.log('\n========== 성공한 모델 리스트 ==========');
    sorted.forEach(([model, count]) => {
      console.log(`  ✅ ${model}: ${count}회 성공`);
    });
    console.log('========================================\n');
  }

  // 모델 우선순위 정렬 (성공한 모델 우선, 그 다음 gemini-2.0-flash 계열 우선)
  static getPrioritizedModels(availableModels) {
    if (!availableModels || availableModels.length === 0) {
      return [];
    }

    // Gemma 모델 포함 (필터링 제거)
    const geminiModels = availableModels;

    // 성공한 모델과 그렇지 않은 모델 분리
    const successful = [];
    const unsuccessful = [];
    
    for (const model of geminiModels) {
      if (this._successfulModels.has(model)) {
        successful.push(model);
      } else {
        unsuccessful.push(model);
      }
    }

    // 성공한 모델은 성공 횟수 순으로 정렬
    successful.sort((a, b) => {
      const countA = this._successfulModels.get(a) || 0;
      const countB = this._successfulModels.get(b) || 0;
      return countB - countA; // 내림차순
    });

    // 성공하지 않은 모델은 gemini-2.5-flash 계열 우선 정렬 (할당량 있음)
    const performanceOrder = [
      'gemini-2.5-flash-lite',      // 할당량 있음 (0/10, 0/250K, 0/20) - 최우선
      'gemini-2.5-flash',           // 할당량 있음 (0/5, 0/250K, 0/20)
      'gemini-2.5-flash-tts',       // 할당량 있음 (0/3, 0/10K, 0/10)
      'gemini-2.5-flash-live',      // Live API (일반 generateContent 미지원 가능)
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash',
      'gemini-2.0-flash-thinking-exp-001',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini-ultra'
    ];
    
    unsuccessful.sort((a, b) => {
      const indexA = performanceOrder.indexOf(a);
      const indexB = performanceOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // 성공한 모델 먼저, 그 다음 성공하지 않은 모델
    const prioritized = [...successful, ...unsuccessful];
    
    console.log('[LocalAIApi] 모델 우선순위:', prioritized);
    return prioritized;
  }

  static async requestGemini(messages, model, options = {}, apiVersion = null) {
    const cfg = config;
    const apiKey = cfg.api_key;

    if (!apiKey) {
      console.error('[LocalAIApi] API 키가 없습니다. GEMINI_API_KEY를 확인하세요.');
      return {
        success: false,
        error: 'api_key_missing',
        message: 'GEMINI_API_KEY is not defined; aborting AI request.',
      };
    }
    
    console.log('[LocalAIApi] API 키 확인됨:', apiKey.substring(0, 10) + '...');
    console.log('[LocalAIApi] 요청 모델:', model);
    console.log('[LocalAIApi] API 버전:', apiVersion || cfg.api_version || 'v1');

    // Gemini API 형식으로 변환
    const contents = [];
    let systemInstruction = null;
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini v1 API는 systemInstruction 필드를 지원하지 않으므로 저장해두고 첫 user 메시지에 포함
        systemInstruction = msg.content;
        continue;
      }
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role: role,
        parts: [{ text: String(msg.content || '') }]
      });
    }

    // contents가 비어있으면 에러
    if (contents.length === 0) {
      return {
        success: false,
        error: 'invalid_input',
        message: 'No valid messages found after processing.',
      };
    }

    // System instruction이 있으면 첫 번째 user 메시지에 포함
    // Gemini v1 API는 systemInstruction 필드를 지원하지 않음
    if (systemInstruction && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = String(systemInstruction) + '\n\n' + contents[0].parts[0].text;
    }

    // Gemini API 엔드포인트: apiVersion 파라미터가 있으면 사용, 없으면 config에서 가져옴
    const version = apiVersion || cfg.api_version || 'v1beta';
    const url = `${cfg.base_url}/${version}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    console.log('[LocalAIApi] 요청 URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    const baseTimeout = cfg.timeout != null ? Number(cfg.timeout) : 30;
    let timeoutSec = options.timeout != null ? Number(options.timeout) : baseTimeout;
    if (!timeoutSec || timeoutSec <= 0) timeoutSec = 30;

    const headers = [
      ['Content-Type', 'application/json'],
    ];

    // Gemini API 요청 본문 구성 (systemInstruction 필드 제거)
    const requestBody = {
      contents: contents,
    };

    let body;
    try {
      body = JSON.stringify(requestBody);
    } catch (e) {
      return {
        success: false,
        error: 'json_encode_failed',
        message: 'Failed to encode request body to JSON.',
      };
    }

    console.log('[LocalAIApi] Gemini API 호출:', {
      url: url.replace(apiKey, 'API_KEY_HIDDEN'),
      model: model,
      contentsCount: contents.length
    });

    return this.sendFetch(url, 'POST', body, headers, timeoutSec, true);
  }

  static async requestOpenAI(messages, model, options = {}) {
    const cfg = config;
    const apiKey = cfg.api_key;

    if (!apiKey) {
      return {
        success: false,
        error: 'api_key_missing',
        message: 'OPENAI_API_KEY is not defined; aborting AI request.',
      };
    }

    const url = cfg.base_url + cfg.api_endpoint;
    const baseTimeout = cfg.timeout != null ? Number(cfg.timeout) : 30;
    let timeoutSec = options.timeout != null ? Number(options.timeout) : baseTimeout;
    if (!timeoutSec || timeoutSec <= 0) timeoutSec = 30;

    const headers = [
      ['Content-Type', 'application/json'],
      ['Authorization', `Bearer ${apiKey}`],
    ];

    const requestBody = {
      model: model,
      messages: messages,
    };

    let body;
    try {
      body = JSON.stringify(requestBody);
    } catch (e) {
      return {
        success: false,
        error: 'json_encode_failed',
        message: 'Failed to encode request body to JSON.',
      };
    }

    return this.sendFetch(url, 'POST', body, headers, timeoutSec, true);
  }

  // Legacy method - Gemini만 사용
  static async request(path, payload = {}, options = {}) {
    if (Array.isArray(payload.input)) {
      const cfg = config;
      const model = payload.model || cfg.default_model || 'gemini-2.5-flash';
      return this.requestGemini(payload.input, model, options);
    }
    return {
      success: false,
      error: 'invalid_request',
      message: 'Invalid request format for AI API.',
    };
  }

  static async awaitResponse(aiRequestId, options = {}) {
    const cfg = config;

    let timeout = options.timeout != null ? Number(options.timeout) : 300;
    let interval = options.interval != null ? Number(options.interval) : 5;
    if (!interval || interval <= 0) interval = 5;
    const perCallTimeout = options.timeout_per_call != null ? Number(options.timeout_per_call) : null;

    const deadline = Date.now() + Math.max(timeout * 1000, interval * 1000);
    const headers = options.headers ?? [];

    for (;;) {
      const statusResp = await this.fetchStatus(aiRequestId, {
        headers,
        timeout: perCallTimeout,
      });
      if (statusResp.success) {
        const data = statusResp.data ?? {};
        const statusValue = data.status;
        if (statusValue === 'success') {
          return {
            success: true,
            status: 200,
            data: data.response ?? data,
          };
        }
        if (statusValue === 'failed') {
          return {
            success: false,
            status: 500,
            error: typeof data.error === 'string' ? data.error : 'AI request failed',
            data,
          };
        }
      } else {
        return statusResp;
      }

      if (Date.now() >= deadline) {
        return {
          success: false,
          error: 'timeout',
          message: 'Timed out waiting for AI response.',
        };
      }

      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    }
  }

  static async fetchStatus(aiRequestId, options = {}) {
    const cfg = config;
    const projectUuid = cfg.project_uuid;
    if (!projectUuid) {
      return {
        success: false,
        error: 'project_uuid_missing',
        message: 'PROJECT_UUID is not defined; aborting status check.',
      };
    }

    const statusPath = this.resolveStatusPath(aiRequestId, cfg);
    const url = this.buildUrl(statusPath, cfg.base_url);

    const baseTimeout = cfg.timeout != null ? Number(cfg.timeout) : 30;
    let timeoutSec = options.timeout != null ? Number(options.timeout) : baseTimeout;
    if (!timeoutSec || timeoutSec <= 0) timeoutSec = 30;

    const verifyTls = options.verify_tls != null ? !!options.verify_tls : !!cfg.verify_tls;

    const projectHeader = cfg.project_header;
    const headers = [
      ['Accept', 'application/json'],
      [projectHeader, projectUuid],
    ];
    if (Array.isArray(options.headers)) {
      for (const header of options.headers) {
        if (typeof header === 'string' && header.includes(':')) {
          const [name, ...rest] = header.split(':');
          headers.push([name.trim(), rest.join(':').trim()]);
        }
      }
    }

    return this.sendFetch(url, 'GET', null, headers, timeoutSec, verifyTls);
  }

  static extractText(response) {
    const payload = (response && response.data) || response;
    if (!payload || typeof payload !== 'object') return '';

    // Gemini API format: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    if (
      payload.candidates &&
      Array.isArray(payload.candidates) &&
      payload.candidates[0] &&
      payload.candidates[0].content &&
      payload.candidates[0].content.parts &&
      Array.isArray(payload.candidates[0].content.parts) &&
      payload.candidates[0].content.parts[0] &&
      payload.candidates[0].content.parts[0].text
    ) {
      return String(payload.candidates[0].content.parts[0].text);
    }

    // OpenAI API format: { choices: [{ message: { content: "..." } }] }
    if (
      payload.choices &&
      Array.isArray(payload.choices) &&
      payload.choices[0] &&
      payload.choices[0].message &&
      payload.choices[0].message.content
    ) {
      return String(payload.choices[0].message.content);
    }

    // Legacy format support (for backward compatibility)
    if (Array.isArray(payload.output)) {
      let combined = '';
      for (const item of payload.output) {
        if (!item || !Array.isArray(item.content)) continue;
        for (const block of item.content) {
          if (block && block.type === 'output_text' && block.text) {
            combined += block.text;
          }
        }
      }
      if (combined) return combined;
    }

    return '';
  }

  static decodeJsonFromResponse(response) {
    const text = this.extractText(response);
    if (!text) return null;

    try {
      const decoded = JSON.parse(text);
      if (decoded && typeof decoded === 'object') return decoded;
    } catch {
      // ignore
    }

    const stripped = text.trim().replace(/^```json\s*/i, '').replace(/```$/m, '').trim();
    if (stripped && stripped !== text) {
      try {
        const decoded = JSON.parse(stripped);
        if (decoded && typeof decoded === 'object') return decoded;
      } catch {
        // ignore
      }
    }

    return null;
  }

  static buildUrl(path, baseUrl) {
    const trimmed = String(path || '').trim();
    if (!trimmed) return baseUrl;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return baseUrl + trimmed;
    return baseUrl.replace(/\/+$/, '') + '/' + trimmed;
  }

  static resolveStatusPath(aiRequestId, cfg) {
    const basePath = cfg.responses_path || '';
    let trimmed = basePath.replace(/\/+$/, '');
    if (!trimmed) {
      return `/ai-request/${encodeURIComponent(String(aiRequestId))}/status`;
    }
    if (!trimmed.endsWith('/ai-request')) {
      trimmed += '/ai-request';
    }
    return `${trimmed}/${encodeURIComponent(String(aiRequestId))}/status`;
  }

  static async sendFetch(url, method, body, headers, timeoutSec, verifyTls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

    const headerObj = {};
    for (const [name, value] of headers) {
      if (name) headerObj[name] = value;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: headerObj,
        body: body != null ? body : undefined,
        signal: controller.signal,
        // node-fetch respects NODE_TLS_REJECT_UNAUTHORIZED; we mimic verify_tls
        // by temporarily adjusting it if needed.
      });

      clearTimeout(timeoutId);

      const status = res.status;
      const text = await res.text();
      let decoded = null;
      if (text) {
        try {
          decoded = JSON.parse(text);
        } catch {
          decoded = null;
        }
      }

      console.log('[LocalAIApi] API 응답:', {
        status: status,
        hasData: !!decoded,
        error: decoded?.error,
        errorMessage: decoded?.error?.message
      });

      if (status >= 200 && status < 300) {
        return {
          success: true,
          status,
          data: decoded ?? text,
        };
      }

      // API error format handling
      let errorMessage = 'AI API request failed';
      if (decoded && typeof decoded === 'object') {
        // OpenAI API error format: { error: { message: "...", type: "..." } }
        if (decoded.error && typeof decoded.error === 'object' && decoded.error.message) {
          errorMessage = decoded.error.message;
        }
        // Gemini API error format: { error: { message: "...", code: ... } }
        else if (decoded.error && typeof decoded.error === 'object' && decoded.error.message) {
          errorMessage = decoded.error.message;
        }
        // Generic error format
        else {
          errorMessage = decoded.error || decoded.message || errorMessage;
        }
      } else if (text) {
        errorMessage = text;
      }

      // 상세 오류 로깅 (디버깅용)
      console.error('[LocalAIApi] API 오류 상세:', {
        status: status,
        errorMessage: errorMessage,
        decoded: decoded,
        text: text ? text.substring(0, 500) : null,
        url: url ? url.replace(/key=[^&]+/, 'key=HIDDEN') : null
      });
      
      // 429 오류가 실제 할당량 문제인지 확인
      if (status === 429) {
        console.error('[LocalAIApi] ⚠️ 429 오류 상세 분석:');
        console.error('  - 오류 메시지:', errorMessage);
        console.error('  - 요청 URL:', url ? url.replace(/key=[^&]+/, 'key=HIDDEN') : '없음');
        if (decoded && decoded.error) {
          console.error('  - 오류 코드:', decoded.error.code);
          console.error('  - 오류 상태:', decoded.error.status);
          console.error('  - 전체 오류 객체:', JSON.stringify(decoded.error, null, 2));
          
          // 오류 메시지에서 모델 관련 힌트 찾기
          const errorMsgLower = String(errorMessage).toLowerCase();
          if (errorMsgLower.includes('model') || errorMsgLower.includes('not found') || errorMsgLower.includes('not available')) {
            console.error('  - ⚠️ 모델 관련 오류 가능성: 모델 이름이 잘못되었거나 사용할 수 없을 수 있습니다');
            console.error('  - 해결 방법: ListModels API로 실제 존재하는 모델 이름을 확인하세요');
          }
          if (errorMsgLower.includes('quota') || errorMsgLower.includes('limit') || errorMsgLower.includes('billing')) {
            console.error('  - ⚠️ 할당량/결제 관련 오류: 실제 할당량 초과 또는 결제 문제일 수 있습니다');
          }
        }
      }
      
      // 404 오류도 상세 분석
      if (status === 404) {
        console.error('[LocalAIApi] ⚠️ 404 오류 상세 분석:');
        console.error('  - 모델이 존재하지 않거나 API 버전이 맞지 않을 수 있습니다');
        console.error('  - 요청 URL:', url ? url.replace(/key=[^&]+/, 'key=HIDDEN') : '없음');
        console.error('  - 해결 방법: ListModels API로 실제 존재하는 모델 이름과 API 버전을 확인하세요');
      }

      return {
        success: false,
        status,
        error: errorMessage,
        response: decoded ?? text,
      };
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e && e.name === 'AbortError'
        ? 'Request timed out'
        : (e && e.message) || 'Unknown fetch error';
      return {
        success: false,
        error: 'fetch_error',
        message: msg,
      };
    }
  }
}

module.exports = LocalAIApi;



