# 문제 해결 가이드

## OpenAI API 할당량 초과 오류

### 오류 메시지
```
Error: You exceeded your current quota, please check your plan and billing details.
```

### 원인
OpenAI API의 무료 크레딧이 소진되었거나 결제 정보가 설정되지 않았을 때 발생합니다.

### 해결 방법

1. **결제 정보 확인**
   - https://platform.openai.com/account/billing 접속
   - 결제 정보가 설정되어 있는지 확인
   - 결제 정보가 없다면 추가

2. **사용량 확인**
   - https://platform.openai.com/usage 접속
   - 현재 사용량과 남은 크레딧 확인

3. **크레딧 추가**
   - 결제 정보를 설정한 후 크레딧을 추가
   - 무료 크레딧이 소진된 경우 유료 플랜으로 업그레이드 필요

4. **API 키 확인**
   - `.env` 파일의 `OPENAI_API_KEY`가 올바른지 확인
   - API 키가 활성화되어 있는지 확인

### 대안

1. **다른 OpenAI 계정 사용**
   - 새로운 계정을 만들고 무료 크레딧 사용

2. **로컬 AI 모델 사용**
   - Ollama 등 로컬 AI 모델 사용 (구현 필요)

3. **API 사용량 줄이기**
   - 더 짧은 프롬프트 사용
   - gpt-3.5-turbo 모델 사용 (gpt-4보다 저렴)

## 기타 오류

### Python 실행 오류
- Python이 설치되어 있는지 확인: `python --version`
- 필요한 패키지 설치: `pip install matplotlib numpy plotly scipy`

### FFmpeg 오류
- FFmpeg가 설치되어 있는지 확인: `ffmpeg -version`
- Windows: https://ffmpeg.org/download.html 에서 다운로드

### 포트 충돌
- 다른 포트 사용: `.env` 파일에서 `PORT=8001` 등으로 변경

