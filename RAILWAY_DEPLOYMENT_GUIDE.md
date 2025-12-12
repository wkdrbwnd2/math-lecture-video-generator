# Railway 배포 가이드

Python, GNU Octave(MATLAB 대체), Manim MCP 서버를 Railway.app에 배포하는 방법입니다.

## 📋 사전 준비

1. **Railway 계정 생성**
   - https://railway.app 접속
   - GitHub 계정으로 로그인 (무료)

2. **Railway CLI 설치** (선택사항)
   ```bash
   npm install -g @railway/cli
   ```

---

## 🚀 배포 방법

### 방법 1: Railway 웹 대시보드 사용 (권장)

#### 1단계: 프로젝트 생성
1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. 이 저장소 선택

#### 2단계: Python MCP 서버 배포
1. "New Service" 클릭
2. "Empty Service" 선택
3. Settings → Source → Connect GitHub
4. 이 저장소 선택
5. Root Directory: `/` (기본값)
6. Start Command: `node mcp-servers/python-server.js`
7. Port: `8001` (또는 환경 변수로 설정)

#### 3단계: Python 환경 변수 설정
Settings → Variables에서 추가:
```env
PYTHON_MCP_PORT=8001
PYTHON_PATH=python3
SIMULATION_OUTPUT_DIR=/tmp/simulations
NODE_ENV=production
```

#### 4단계: Octave MCP 서버 배포 (MATLAB 대체)
1. "New Service" 클릭
2. 같은 저장소 사용
3. Start Command: `node mcp-servers/octave-server.js`
4. Port: `8002`
5. 환경 변수:
```env
OCTAVE_MCP_PORT=8002
OCTAVE_PATH=octave
SIMULATION_OUTPUT_DIR=/tmp/simulations
NODE_ENV=production
```

**중요**: Railway는 자동으로 Octave를 설치합니다 (Nixpacks 사용 시)

#### 5단계: Manim MCP 서버 배포
1. "New Service" 클릭
2. 같은 저장소 사용
3. Start Command: `node mcp-servers/manim-server.js`
4. Port: `8004`
5. 환경 변수:
```env
MANIM_MCP_PORT=8004
SIMULATION_OUTPUT_DIR=/tmp/simulations
NODE_ENV=production
```

#### 6단계: Public URL 확인
각 서비스의 Settings → Networking에서 Public URL 확인:
- Python: `https://python-mcp-production.up.railway.app`
- Octave: `https://octave-mcp-production.up.railway.app`
- Manim: `https://manim-mcp-production.up.railway.app`

---

### 방법 2: Railway CLI 사용

#### 1단계: 로그인
```bash
railway login
```

#### 2단계: 프로젝트 초기화
```bash
railway init
```

#### 3단계: Python 서버 배포
```bash
railway up --service python-mcp
```

#### 4단계: 환경 변수 설정
```bash
railway variables set PYTHON_MCP_PORT=8001
railway variables set PYTHON_PATH=python3
```

---

## 🔧 로컬 .env 파일 업데이트

Railway 배포 후, 로컬 `.env` 파일을 업데이트:

```env
# MCP 모드 활성화
USE_MCP_SIMULATION=true

# Railway 배포된 서버 URL (Public URL 사용)
PYTHON_MCP_ENDPOINT=https://python-mcp-production.up.railway.app
OCTAVE_MCP_ENDPOINT=https://octave-mcp-production.up.railway.app
MANIM_MCP_ENDPOINT=https://manim-mcp-production.up.railway.app
```

---

## 📝 Railway 배포 체크리스트

- [ ] Railway 계정 생성
- [ ] GitHub 저장소 연결
- [ ] Python MCP 서버 배포
- [ ] Manim MCP 서버 배포
- [ ] 환경 변수 설정
- [ ] Public URL 확인
- [ ] 로컬 .env 파일 업데이트
- [ ] Health check 테스트

---

## 🧪 테스트

배포 후 Health check:

```bash
# Python 서버
curl https://python-mcp-production.up.railway.app/health

# Manim 서버
curl https://manim-mcp-production.up.railway.app/health
```

---

## 💰 비용

- **무료 티어**: $5 크레딧/월
- **사용량**: 서버 3개 × 약 $1.5-2/월 = $4.5-6/월
- **결과**: 무료 티어로 충분히 사용 가능!
- **GNU Octave**: 완전 무료 (MATLAB 대체)

---

## ⚠️ 주의사항

1. **파일 저장소**: Railway는 임시 파일 시스템을 사용합니다. 비디오 파일은 외부 스토리지(S3 등)에 저장하거나 다운로드해야 합니다.

2. **타임아웃**: Railway는 요청 타임아웃이 있습니다. 긴 실행 시간이 필요한 경우 고려해야 합니다.

3. **환경 변수**: 민감한 정보는 Railway의 환경 변수로 설정하세요.

---

## 🔄 업데이트

코드 변경 후 자동으로 재배포됩니다 (GitHub 연결 시).

수동 재배포:
```bash
railway up
```

