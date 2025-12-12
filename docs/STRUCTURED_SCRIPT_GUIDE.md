# 구조화된 대본 시스템 가이드

## 개요

대본 생성 AI가 구조화된 JSON 형식으로 대본을 생성하고, 각 세그먼트마다 TTS 파라미터(속도, 피치, 톤, 감정)를 포함합니다. TTS Generator가 이 파라미터를 사용하여 각 세그먼트별로 다른 목소리 스타일로 오디오를 생성합니다.

## 구조화된 대본 형식

### JSON 형식

```json
{
  "metadata": {
    "title": "수학 강의",
    "totalDuration": 120,
    "language": "ko"
  },
  "segments": [
    {
      "id": "segment-1",
      "startTime": 0,
      "endTime": 5,
      "text": "안녕하세요",
      "tts": {
        "pronunciation": "안녕하세요",
        "speed": "normal",
        "pitch": "normal",
        "volume": "normal",
        "tone": "친근함",
        "emotion": "welcoming"
      }
    },
    {
      "id": "segment-2",
      "startTime": 5,
      "endTime": 12,
      "text": "오늘은 수학에 대해 배워보겠습니다",
      "tts": {
        "pronunciation": "오늘은 수학에 대해 배워보겠습니다",
        "speed": "slow",
        "pitch": "normal",
        "volume": "normal",
        "tone": "교육적",
        "emotion": "enthusiastic"
      }
    }
  ]
}
```

### TTS 파라미터 설명

- **speed**: `slow`, `normal`, `fast` - 말하기 속도
- **pitch**: `low`, `normal`, `high`, `+10%`, `-10%` - 음높이
- **volume**: `quiet`, `normal`, `loud` - 볼륨
- **tone**: `친근함`, `교육적`, `진지함`, `밝음`, `차분함`, `열정적` - 톤
- **emotion**: `welcoming`, `enthusiastic`, `calm`, `excited`, `serious`, `friendly` - 감정

## 사용 방법

### 1. 대본 생성

Script 도구에서 대본을 생성하면 자동으로 구조화된 JSON 형식으로 생성됩니다.

- JSON 파일: `outputs/scripts/script_[timestamp].json`
- 텍스트 파일: `outputs/scripts/script_[timestamp].txt` (하위 호환성)

### 2. TTS 생성

구조화된 대본을 사용하여 비디오를 생성하면:

1. 각 세그먼트마다 TTS 파라미터가 적용됩니다
2. Google Cloud TTS API 키가 있으면 SSML을 사용하여 정확한 제어가 가능합니다
3. API 키가 없으면 gTTS를 사용하지만, SSML 파라미터는 적용되지 않습니다

### 3. 환경 변수 설정

#### Google Cloud TTS API (SSML 지원, 권장)

```bash
# .env 파일에 추가
GOOGLE_CLOUD_TTS_API_KEY=your_api_key_here
```

**설정 방법:**
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 선택
3. "Text-to-Speech API" 활성화
4. "사용자 인증 정보" → "API 키 만들기"
5. `.env` 파일에 추가

**무료 티어:** 월 0-4백만 글자 무료

## TTS 모델 비교

| 기능 | Google Cloud TTS (SSML) | gTTS (Fallback) |
|------|------------------------|-----------------|
| 속도 제어 | ✅ | ⚠️ (slow/normal만) |
| 피치 제어 | ✅ | ❌ |
| 볼륨 제어 | ✅ | ❌ |
| 감정/톤 제어 | ⚠️ (간접) | ❌ |
| 비용 | 무료 티어 있음 | 완전 무료 |
| 품질 | 높음 | 중간 |

## 기존 대본과의 호환성

- 기존 `.txt` 파일도 계속 사용 가능합니다
- 구조화된 대본이 없으면 기본 TTS를 사용합니다
- JSON 파일이 있으면 우선적으로 사용됩니다

## 예시

### 대본 생성 프롬프트 예시

```
"수학 강의를 만들어줘. 친근하게 시작하고, 설명 부분은 교육적으로, 
중요한 부분은 진지하게 말해줘."
```

### 생성된 대본 예시

```json
{
  "segments": [
    {
      "text": "안녕하세요",
      "tts": {
        "tone": "친근함",
        "emotion": "welcoming",
        "speed": "normal"
      }
    },
    {
      "text": "오늘은 미적분에 대해 배워보겠습니다",
      "tts": {
        "tone": "교육적",
        "emotion": "enthusiastic",
        "speed": "slow"
      }
    }
  ]
}
```

## 문제 해결

### TTS 파라미터가 적용되지 않음

- Google Cloud TTS API 키가 설정되어 있는지 확인
- API 키가 없으면 gTTS를 사용하며, SSML 파라미터는 적용되지 않습니다

### JSON 파싱 오류

- 대본 생성 AI가 올바른 JSON 형식을 생성하지 못할 수 있습니다
- 이 경우 자동으로 기본 형식으로 변환됩니다
- 대본 생성 프롬프트를 더 명확하게 작성해보세요

### 오디오 생성 실패

- Python과 gtts 패키지가 설치되어 있는지 확인
- Google Cloud TTS API 키가 올바른지 확인
- 인터넷 연결 확인 (gTTS는 온라인 필요)

## 향후 개선 사항

- [ ] Coqui XTTS-v2 통합 (참조 음성으로 감정/톤 제어)
- [ ] 더 많은 TTS 파라미터 지원
- [ ] 실시간 TTS 미리보기
- [ ] TTS 파라미터 수동 편집 기능



