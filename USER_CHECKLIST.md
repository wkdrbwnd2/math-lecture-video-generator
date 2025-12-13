# 사용자 체크리스트 - 완전 클라우드 구성

## ✅ 해야 할 일

### 1단계: Railway 계정 생성 및 배포 (30-40분)

#### A. Railway 계정 만들기
- [ ] https://railway.app 접속
- [ ] "Start a New Project" 클릭
- [ ] GitHub 계정으로 로그인

#### B. Python MCP 서버 배포
- [ ] Railway 대시보드에서 "New Project" 클릭
- [ ] "Deploy from GitHub repo" 선택
- [ ] 이 저장소 선택
- [ ] "New Service" 클릭 → "Empty Service"
- [ ] Settings → Source → Connect GitHub
- [ ] Settings → Deploy → Start Command 입력: `node mcp-servers/python-server.js`
- [ ] Settings → Variables → Add Variable:
  ```
  PYTHON_MCP_PORT=8001
  PYTHON_PATH=python3
  SIMULATION_OUTPUT_DIR=/tmp/simulations
  ```
- [ ] Settings → Networking → Generate Domain 클릭
- [ ] 생성된 URL 복사 (예: `https://python-mcp-production.up.railway.app`)

#### C. Octave MCP 서버 배포 (MATLAB 대체)
- [ ] 같은 프로젝트에서 "New Service" 클릭
- [ ] 같은 저장소 선택
- [ ] Start Command: `node mcp-servers/octave-server.js`
- [ ] Variables:
  ```
  OCTAVE_MCP_PORT=8002
  OCTAVE_PATH=octave
  SIMULATION_OUTPUT_DIR=/tmp/simulations
  ```
- [ ] Generate Domain 클릭
- [ ] 생성된 URL 복사 (예: `https://octave-mcp-production.up.railway.app`)

#### D. Manim MCP 서버 배포
- [ ] 같은 프로젝트에서 "New Service" 클릭
- [ ] 같은 저장소 선택
- [ ] Start Command: `node mcp-servers/manim-server.js`
- [ ] Variables:
  ```
  MANIM_MCP_PORT=8004
  SIMULATION_OUTPUT_DIR=/tmp/simulations
  ```
- [ ] Generate Domain 클릭
- [ ] 생성된 URL 복사 (예: `https://manim-mcp-production.up.railway.app`)

---

### 2단계: 로컬 설정 (5분)

#### A. .env 파일 수정
- [ ] 프로젝트 루트의 `.env` 파일 열기
- [ ] 다음 내용 추가/수정:
  ```env
  USE_MCP_SIMULATION=true
  
  PYTHON_MCP_ENDPOINT=https://your-python-mcp.railway.app
  OCTAVE_MCP_ENDPOINT=https://your-octave-mcp.railway.app
  MANIM_MCP_ENDPOINT=https://your-manim-mcp.railway.app
  ```
- [ ] `your-python-mcp.railway.app` 부분을 실제 Railway URL로 변경

#### B. 패키지 설치
- [ ] 터미널에서 `npm install` 실행

#### C. 서버 실행
- [ ] 터미널에서 `npm start` 실행

---

### 3단계: 테스트 (5분)

- [ ] 브라우저에서 `http://localhost:8000/simulation` 접속
- [ ] 채팅에서 "python으로 sin 그래프 만들어줘" 입력
- [ ] "Generate Simulation" 버튼 클릭
- [ ] Railway 서버를 통해 실행되는지 확인

---

## 📝 알려줘야 할 정보

### ❌ 알려줄 필요 없음!

모든 것이 자동으로 설정됩니다:
- ✅ Python, Octave, Manim 설치: Railway가 자동으로 처리
- ✅ 포트 설정: Railway가 자동으로 할당
- ✅ 환경 변수: 위의 체크리스트대로 입력하면 됨
- ✅ 프로그램 경로: Railway에서 자동으로 찾음

**단, Railway에서 받은 URL만 `.env` 파일에 입력하면 됩니다!**

---

## 🔍 확인 방법

### Railway 서버 Health Check
각 서버의 URL로 접속해서 확인:
```
https://your-python-mcp.railway.app/health
https://your-octave-mcp.railway.app/health
https://your-manim-mcp.railway.app/health
```

응답 예시:
```json
{"status":"ok","service":"python-mcp","python":"python3","port":8001}
```

---

## 💰 비용

- **Railway**: 무료 티어 ($5 크레딧/월) - 충분함
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
1. Railway 대시보드 → Deployments → Logs 확인
2. 환경 변수가 올바른지 확인
3. Public URL이 올바른지 확인

### Octave가 실행되지 않을 때
1. Railway 로그에서 Octave 설치 확인
2. 환경 변수 `OCTAVE_PATH=octave` 확인

---

## 📚 상세 가이드

더 자세한 내용은 다음 파일 참고:
- `SETUP_CLOUD.md` - 상세 설정 가이드
- `RAILWAY_DEPLOYMENT_GUIDE.md` - Railway 배포 상세 가이드
- `CLOUD_SETUP_COMPLETE.md` - 전체 체크리스트



