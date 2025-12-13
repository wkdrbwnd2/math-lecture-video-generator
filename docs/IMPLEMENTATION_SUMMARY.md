# 구조화된 대본 시스템 구현 완료

## 구현된 기능

### 1. 구조화된 대본 생성
- **파일**: `workers/script-generator.js`
- 대본 생성 AI가 JSON 형식으로 대본 생성
- 각 세그먼트마다 시간, TTS 파라미터 포함
- 기존 TXT 형식도 함께 생성 (하위 호환성)

### 2. TTS Generator
- **파일**: `workers/tts-generator.js`
- 구조화된 대본에서 각 세그먼트별 오디오 생성
- SSML 기반 파라미터 제어 (Google Cloud TTS)
- gTTS fallback (API 키 없을 때)

### 3. Video Composer 통합
- **파일**: `workers/video-composer.js`
- 구조화된 대본 자동 감지
- 각 세그먼트별 다른 TTS 파라미터 적용

### 4. 서버 통합
- **파일**: `server.js`
- JSON 대본 파일 인식
- 기존 TXT 대본과 호환성 유지

## 필요한 설정

### 필수 (없어도 작동, 하지만 SSML 제어 불가)
- Python 3.x
- gtts 패키지: `pip install gtts`

### 선택 (SSML 제어를 위해 권장)
- Google Cloud TTS API 키
  - `.env` 파일에 추가: `GOOGLE_CLOUD_TTS_API_KEY=your_key_here`
  - 무료 티어: 월 0-4백만 글자

## 사용 방법

### 1. 대본 생성
Script 도구에서 대본 생성 → 자동으로 구조화된 JSON 형식 생성

### 2. 비디오 생성
Video 도구에서 비디오 생성 → 구조화된 대본 자동 감지 및 사용

### 3. TTS 파라미터 확인
생성된 JSON 파일 (`outputs/scripts/script_*.json`)에서 각 세그먼트의 TTS 파라미터 확인

## 작동 방식

1. **대본 생성**: AI가 구조화된 JSON 형식으로 대본 생성
   - 각 세그먼트에 시간, 텍스트, TTS 파라미터 포함
   
2. **TTS 생성**: 각 세그먼트마다 다른 파라미터로 오디오 생성
   - Google Cloud TTS API 키 있음 → SSML 사용 (정확한 제어)
   - API 키 없음 → gTTS 사용 (기본 제어만)

3. **비디오 합성**: 생성된 오디오와 비디오 합성

## 예시

### 생성된 대본 (JSON)
```json
{
  "segments": [
    {
      "text": "안녕하세요",
      "tts": {
        "speed": "normal",
        "pitch": "normal",
        "tone": "친근함",
        "emotion": "welcoming"
      }
    },
    {
      "text": "오늘은 수학에 대해 배워보겠습니다",
      "tts": {
        "speed": "slow",
        "pitch": "normal",
        "tone": "교육적",
        "emotion": "enthusiastic"
      }
    }
  ]
}
```

### TTS 생성 결과
- 첫 번째 세그먼트: 친근한 톤, 보통 속도
- 두 번째 세그먼트: 교육적 톤, 느린 속도

## 문제 해결

### TTS 파라미터가 적용되지 않음
- Google Cloud TTS API 키 설정 확인
- API 키가 없으면 gTTS 사용 (SSML 파라미터 미적용)

### JSON 파싱 오류
- 대본 생성 AI가 올바른 JSON을 생성하지 못할 수 있음
- 자동으로 기본 형식으로 변환됨

### 오디오 생성 실패
- Python과 gtts 패키지 설치 확인
- 인터넷 연결 확인 (gTTS는 온라인 필요)





