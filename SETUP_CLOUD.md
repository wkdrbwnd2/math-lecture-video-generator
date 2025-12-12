# 클라우드 설정 가이드 (사용자용) - 완전 클라우드 버전

## 🎯 목표

로컬에 아무것도 설치하지 않고 완전히 클라우드에서 실행하기

---

## ✅ 해야 할 일 (순서대로)

### 1단계: Railway 계정 생성 및 배포

#### A. Railway 계정 만들기
1. https://railway.app 접속
2. "Start a New Project" 클릭
3. GitHub 계정으로 로그인

#### B. Python MCP 서버 배포
1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. 이 저장소 선택
4. "New Service" 클릭 → "Empty Service"
5. Settings → Source → Connect GitHub
6. Settings → Deploy → Start Command 입력:
   ```
   node mcp-servers/python-server.js
   ```
7. Settings → Variables → Add Variable:
   ```
   PYTHON_MCP_PORT=8001
   PYTHON_PATH=python3
   SIMULATION_OUTPUT_DIR=/tmp/simulations
   ```
8. Settings → Networking → Generate Domain 클릭
9. 생성된 URL 복사 (예: `https://python-mcp-production.up.railway.app`)

#### C. Octave MCP 서버 배포 (MATLAB 대체)
1. 같은 프로젝트에서 "New Service" 클릭
2. 같은 저장소 선택
3. Start Command:
   ```
   node mcp-servers/octave-server.js
   ```
4. Variables:
   ```
   OCTAVE_MCP_PORT=8002
   OCTAVE_PATH=octave
   SIMULATION_OUTPUT_DIR=/tmp/simulations
   ```
5. Generate Domain 클릭
6. 생성된 URL 복사 (예: `https://octave-mcp-production.up.railway.app`)

**참고**: Railway는 자동으로 Octave를 설치합니다 (Nixpacks 사용 시)

#### D. Manim MCP 서버 배포
1. 같은 프로젝트에서 "New Service" 클릭
2. 같은 저장소 선택
3. Start Command:
   ```
   node mcp-servers/manim-server.js
   ```
4. Variables:
   ```
   MANIM_MCP_PORT=8004
   SIMULATION_OUTPUT_DIR=/tmp/simulations
   ```
5. Generate Domain 클릭
6. 생성된 URL 복사 (예: `https://manim-mcp-production.up.railway.app`)

**예상 시간**: 30-40분

**참고**: MATLAB 평가판 설치 불필요! GNU Octave를 사용합니다.

---

### 2단계: 로컬 설정

#### A. .env 파일 수정

프로젝트 루트의 `.env` 파일을 열고 다음 내용 추가/수정:

```env
# MCP 모드 활성화
USE_MCP_SIMULATION=true

# Railway 배포된 서버 URL (위에서 복사한 URL로 변경!)
PYTHON_MCP_ENDPOINT=https://your-python-mcp.railway.app
OCTAVE_MCP_ENDPOINT=https://your-octave-mcp.railway.app
MANIM_MCP_ENDPOINT=https://your-manim-mcp.railway.app
```

**주의**: `your-python-mcp.railway.app` 부분을 실제 Railway에서 받은 URL로 변경하세요!

#### B. 패키지 설치

```bash
npm install
```

#### C. 메인 서버 실행

```bash
npm start
```

**예상 시간**: 5분

**참고**: MCP 서버들은 모두 Railway에서 실행되므로 로컬에서 실행할 필요 없음!

---

### 3단계: 테스트

1. 브라우저에서 `http://localhost:8000/simulation` 접속
2. 채팅에서 "python으로 sin 그래프 만들어줘" 입력
3. "Generate Simulation" 버튼 클릭
4. Railway 서버를 통해 실행되는지 확인

---

## 🔍 확인 방법

### Railway 서버 확인
```bash
# Python 서버
curl https://your-python-mcp.railway.app/health

# Octave 서버
curl https://your-octave-mcp.railway.app/health

# Manim 서버
curl https://your-manim-mcp.railway.app/health
```

응답이 `{"status":"ok",...}` 형태면 정상입니다.

---

## 💰 비용

- **Railway**: 무료 티어 ($5 크레딧/월)
- **GNU Octave**: 완전 무료
- **총 비용**: $0 (무제한)

---

## ⚠️ 주의사항

1. **Railway URL**: `.env` 파일의 URL을 정확히 입력하세요
2. **포트 충돌**: 로컬에서 MCP 서버를 실행하지 않으므로 포트 충돌 걱정 없음
3. **완전 클라우드**: 모든 시뮬레이션이 Railway에서 실행됩니다

---

## 🐛 문제 해결

### Railway 서버가 응답하지 않을 때
- Railway 대시보드 → Deployments → Logs 확인
- 환경 변수가 올바른지 확인
- Public URL이 올바른지 확인
- Health check 엔드포인트 테스트

### Octave가 실행되지 않을 때
- Railway 로그에서 Octave 설치 확인
- 환경 변수 `OCTAVE_PATH=octave` 확인
- Health check 엔드포인트 테스트

### MCP 서버 연결 실패 시
- `.env` 파일의 URL 확인
- Railway 서버가 실행 중인지 확인
- 방화벽 설정 확인

---

## 📞 다음 단계

설정이 완료되면:
1. `/simulation` 페이지에서 테스트
2. Python, Octave, Manim 각각 테스트
3. 문제가 있으면 로그 확인

---

## 📚 참고 문서

- `RAILWAY_DEPLOYMENT_GUIDE.md` - Railway 상세 가이드
- `CLOUD_SETUP_COMPLETE.md` - 전체 체크리스트
- `MCP_IMPLEMENTATION_GUIDE.md` - 전체 구현 가이드

---

## ✅ 완전 클라우드 구성의 장점

- ✅ **로컬 설치 불필요**: Python, MATLAB, Manim 모두 설치 안 해도 됨
- ✅ **완전 무료**: GNU Octave 사용으로 비용 없음
- ✅ **자동 스케일링**: Railway가 자동으로 관리
- ✅ **어디서나 접근**: 인터넷만 있으면 어디서나 사용 가능
