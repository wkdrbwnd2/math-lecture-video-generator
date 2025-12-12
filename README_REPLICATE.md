# Replicate API 설정 가이드

## 개요

AI 비디오 생성 기능이 Replicate API를 사용하도록 전환되었습니다. 이제 GPU 없이도 클라우드에서 AI 비디오를 생성할 수 있습니다.

## 장점

- ✅ **GPU 불필요**: 로컬에 GPU가 없어도 사용 가능
- ✅ **서버 부하 없음**: 모든 처리가 Replicate 클라우드에서 이루어짐
- ✅ **확장성**: 여러 사용자가 동시에 사용 가능
- ✅ **무료 티어**: 초기 사용량은 무료로 제공
- ✅ **간단한 설정**: API 토큰만 설정하면 됨

## 설정 방법

### 1. Replicate 계정 생성

1. https://replicate.com 접속
2. 회원가입 (GitHub 계정으로 간편 가입 가능)
3. 이메일 인증 완료

### 2. API 토큰 발급

1. https://replicate.com/account/api-tokens 접속
2. "Create token" 클릭
3. 토큰 이름 입력 (예: "AI Video Generator")
4. 생성된 토큰 복사 (예: `r8_xxxxxxxxxxxxx`)

⚠️ **주의**: 토큰은 한 번만 표시되므로 안전하게 보관하세요.

### 3. 환경 변수 설정

프로젝트 루트의 `.env` 파일에 다음 내용을 추가하세요:

```env
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

또는 기존 `.env` 파일이 있다면 다음 줄을 추가:

```
REPLICATE_API_TOKEN=여기에_발급받은_토큰_입력
```

### 4. 서버 재시작

환경 변수를 설정한 후 서버를 재시작하세요:

```bash
npm start
```

## 사용 방법

### 기본 사용

1. AI Video 페이지 접속: `http://localhost:8000/ai-video`
2. 비디오 설명 입력 또는 대본 생성
3. "Generate" 버튼 클릭
4. 진행 상황 확인 (1-3분 소요)
5. 생성된 비디오 확인

### 대본 기반 생성

1. Script 도구로 대본 생성
2. AI Video 페이지에서 "Generate" 클릭
3. 시스템이 자동으로 대본에서 비디오 프롬프트 추출
4. AI 비디오 생성

## 가격 정보

### 무료 티어

- 월 $0 크레딧 제공
- 테스트 및 소규모 사용에 적합

### 유료 플랜

- **Starter**: $10/월 (추가 크레딧)
- **Pro**: $20/월 (더 많은 크레딧)
- **Team**: 팀 플랜 (사용량 기반)

자세한 가격 정보: https://replicate.com/pricing

## 지원 모델

현재 기본 모델: `anotherjesse/zeroscope-v2-xl`

다른 모델을 사용하려면 `server.js`에서 모델 ID를 변경할 수 있습니다.

## 문제 해결

### "Replicate API token not configured" 오류

- `.env` 파일에 `REPLICATE_API_TOKEN`이 설정되어 있는지 확인
- 토큰이 올바른지 확인 (앞에 `r8_`가 붙어야 함)
- 서버를 재시작했는지 확인

### 비디오 생성 실패

- Replicate 계정에 크레딧이 있는지 확인
- 인터넷 연결 확인
- 프롬프트가 너무 길지 않은지 확인 (권장: 200자 이하)

### 다운로드 실패

- 출력 디렉토리 권한 확인: `outputs/ai-videos/`
- 디스크 공간 확인

## 로컬 실행 (레거시)

로컬에서 Python 스크립트를 사용하려면 `generateVideoLocal()` 메서드를 사용할 수 있지만, GPU가 필요하고 설정이 복잡합니다. Replicate API 사용을 강력히 권장합니다.

## 추가 리소스

- Replicate 문서: https://replicate.com/docs
- API 참조: https://replicate.com/docs/reference/http
- 커뮤니티: https://replicate.com/community








