# MCP 서버 구현 가이드

## 📋 구현 완료 사항

### 생성된 파일들

1. **MCP 서버 파일들** (`mcp-servers/` 디렉토리)
   - `python-server.js` - Python 실행 서버 (포트 8001)
   - `matlab-server.js` - MATLAB 실행 서버 (포트 8002) - 로컬용
   - `octave-server.js` - GNU Octave 실행 서버 (포트 8002) - 클라우드용
   - `manim-server.js` - Manim 실행 서버 (포트 8004)
   - `README.md` - MCP 서버 사용 가이드

2. **수정된 파일들**
   - `mcp/connection.js` - MCP 연결 및 실행 로직 구현
   - `workers/simulation-runner.js` - MCP 모드 추가
   - `package.json` - MCP 서버 실행 스크립트 추가

---

## 🚀 사용자가 해야 할 일

### 1단계: 패키지 설치

```bash
npm install concurrently
```

또는

```bash
npm install
```

### 2단계: 환경 변수 설정 (`.env` 파일)

`.env` 파일에 다음 내용을 추가하세요:

```env
# MCP 모드 활성화
USE_MCP_SIMULATION=true

# 각 프로그램별 MCP 서버 엔드포인트
PYTHON_MCP_ENDPOINT=http://localhost:8001
MATLAB_MCP_ENDPOINT=http://localhost:8002
MANIM_MCP_ENDPOINT=http://localhost:8004

# 각 MCP 서버의 포트 (선택사항, 기본값 사용 가능)
PYTHON_MCP_PORT=8001
MATLAB_MCP_PORT=8002
MANIM_MCP_PORT=8004

# 각 프로그램의 실행 경로 (로컬에 설치된 경로)
PYTHON_PATH=python
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe

# 출력 디렉토리 (선택사항)
SIMULATION_OUTPUT_DIR=outputs/simulations
```

### 3단계: MCP 서버 실행

**방법 1: 모두 한 번에 실행**
```bash
npm run mcp:all
```

**방법 2: 개별 실행 (별도 터미널에서)**
```bash
# 터미널 1
npm run mcp:python

# 터미널 2
npm run mcp:matlab

# 터미널 3
npm run mcp:manim
```

### 4단계: 메인 서버 실행

새 터미널에서:
```bash
npm start
```

### 5단계: 사용

1. 브라우저에서 `http://localhost:8000/simulation` 접속
2. 채팅으로 시뮬레이션 요청
3. 자동으로 MCP 서버를 통해 실행됩니다!

---

## 🔧 작동 방식

### 전체 흐름

```
사용자 요청 (웹 브라우저)
    ↓
Node.js 서버 (server.js - 포트 8000)
    ↓
SimulationRunner.generateAndRun()
    ↓
AI 코드 생성 (Gemini API)
    ↓
코드 파일 저장
    ↓
[USE_MCP_SIMULATION=true인 경우]
    ↓
MCP 서버로 HTTP 요청
    ├─ Python → python-server.js (포트 8001)
    ├─ MATLAB → matlab-server.js (포트 8002)
    └─ Manim → manim-server.js (포트 8004)
    ↓
각 MCP 서버에서 프로그램 실행
    ↓
결과 파일 생성 (outputs/simulations/)
    ↓
사용자에게 결과 반환
```

### MCP 모드 vs 로컬 모드

**MCP 모드** (`USE_MCP_SIMULATION=true`):
- 각 프로그램이 별도 프로세스(MCP 서버)에서 실행
- 원격 서버로 배포 가능
- 독립적으로 관리 가능

**로컬 모드** (`USE_MCP_SIMULATION=false` 또는 미설정):
- 기존 방식대로 로컬에서 직접 실행
- MCP 서버 실행 불필요

---

## 📁 파일 구조

```
프로젝트/
├── mcp-servers/              ← 새로 생성
│   ├── python-server.js      ← Python MCP 서버
│   ├── matlab-server.js      ← MATLAB MCP 서버
│   ├── manim-server.js       ← Manim MCP 서버
│   └── README.md             ← MCP 서버 가이드
│
├── mcp/
│   └── connection.js         ← 수정됨 (실행 로직 추가)
│
├── workers/
│   └── simulation-runner.js  ← 수정됨 (MCP 모드 추가)
│
├── package.json              ← 수정됨 (스크립트 추가)
│
└── .env                      ← 수정 필요 (환경 변수 추가)
```

---

## ⚙️ 설정 옵션

### MCP 모드 활성화/비활성화

`.env` 파일에서:
```env
USE_MCP_SIMULATION=true   # MCP 모드 활성화
USE_MCP_SIMULATION=false  # 로컬 모드 (기본값)
```

### 원격 서버 사용

각 MCP 서버를 별도 서버에 배포한 경우:

```env
PYTHON_MCP_ENDPOINT=http://remote-server-1:8001
MATLAB_MCP_ENDPOINT=http://remote-server-2:8002
MANIM_MCP_ENDPOINT=http://remote-server-3:8004
```

---

## 🐛 문제 해결

### MCP 서버가 실행되지 않는 경우

1. 포트가 이미 사용 중인지 확인:
   ```bash
   netstat -ano | findstr :8001
   ```

2. 프로그램 경로가 올바른지 확인:
   ```bash
   python --version
   matlab -batch "disp('test')"
   blender --version
   manim --version
   ```

### MCP 실행 실패 시

- 자동으로 로컬 실행 모드로 폴백됩니다
- 콘솔 로그를 확인하세요

---

## 📝 요약

**구현 완료:**
- ✅ 4개 프로그램별 MCP 서버 생성 (Python, MATLAB, Octave, Manim)
- ✅ MCP 연결 로직 구현
- ✅ SimulationRunner에 MCP 모드 추가
- ✅ package.json 스크립트 추가
- ✅ 완전 클라우드 구성 지원 (GNU Octave 사용)

**사용자가 할 일:**
1. Railway에 3개 서버 배포 (Python, Octave, Manim)
2. `.env` 파일에 Railway URL 설정
3. `npm install` 및 `npm start` 실행
4. 사용!

**결과:**
- Python, GNU Octave(MATLAB 대체), Manim을 Railway에서 완전 클라우드 실행
- 로컬 설치 불필요
- 완전 무료 (GNU Octave 사용)
- 자동 스케일링

