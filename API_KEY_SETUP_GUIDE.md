# Gemini API 키 설정 가이드

## 현재 상황
API 키는 정상적으로 로드되었지만, **모든 모델에서 할당량 초과 오류(429)**가 발생하고 있습니다.

## 해결 방법

### 1. Google AI Studio 접속
https://aistudio.google.com/ 에 접속하세요.

### 2. API 키 확인
1. 좌측 메뉴에서 **"Get API key"** 또는 **"API keys"** 클릭
2. 제공하신 API 키 `AIzaSyBj5Ne5CFJPg8GfUDHCenO-b2GhFy3WuE8`가 목록에 있는지 확인
3. API 키가 **활성화(Enabled)** 상태인지 확인

### 3. 할당량 확인 및 활성화
1. **"Usage & limits"** 또는 **"Quotas"** 탭으로 이동
2. 각 모델별 할당량 확인:
   - `gemini-2.5-flash-lite`
   - `gemini-2.5-flash`
   - `gemini-2.5-flash-tts`
   - `gemini-2.5-flash-live`
3. 할당량이 **0/10** 또는 **0/250K**로 표시되어 있더라도, 실제로는 **활성화되지 않았을 수 있습니다**

### 4. 결제 정보 확인
1. **"Billing"** 또는 **"Payment"** 섹션 확인
2. 결제 정보가 등록되어 있는지 확인
3. 일부 모델은 무료 할당량이 있지만, 결제 정보가 없으면 사용할 수 없을 수 있습니다

### 5. API 키 권한 확인
1. API 키 설정에서 다음 권한이 활성화되어 있는지 확인:
   - **Generative Language API** 활성화
   - **Vertex AI API** (필요한 경우)

### 6. 새 API 키 생성 (권장)
만약 위 방법으로 해결되지 않으면:
1. 기존 API 키 삭제
2. 새 API 키 생성
3. 새 API 키를 `.env` 파일에 업데이트
4. 서버 재시작

## 확인 사항 체크리스트
- [ ] API 키가 Google AI Studio에 존재하는가?
- [ ] API 키가 활성화(Enabled) 상태인가?
- [ ] 할당량 탭에서 모델별 할당량이 표시되는가?
- [ ] 결제 정보가 등록되어 있는가?
- [ ] Generative Language API가 활성화되어 있는가?

## 추가 정보
- 할당량 확인: https://ai.dev/usage?tab=rate-limit
- API 문서: https://ai.google.dev/gemini-api/docs/rate-limits





