# AI Video Platform

교육용 비디오를 생성하기 위한 AI 기반 플랫폼입니다.

## 기능

- **대본 생성**: AI를 통해 교육용 비디오 대본 생성
- **시뮬레이션 생성**: 다양한 프로그램으로 수학식 그래프 및 3D 시뮬레이션 생성
  - 지원 프로그램: Python, MATLAB, Blender, R, Julia, Octave, Gnuplot, Graphviz, Processing
- **비디오 생성**: 대본과 시뮬레이션을 결합한 최종 비디오 생성

## 설치 및 실행

### 필수 요구사항

- Node.js (v14 이상)
- Python 3.x (시뮬레이션용, 필수)
- FFmpeg (비디오 생성용, 선택)

### Python 패키지 설치 (필수)

```bash
pip install matplotlib numpy plotly scipy pandas
```

### 추가 프로그램 (선택)

다양한 프로그램을 사용할 수 있습니다. 자세한 설정 방법은 `SETUP_PROGRAMS.md`를 참고하세요:

- **MATLAB** - 수학 시뮬레이션 (유료, 라이선스 필요)
- **Blender** - 3D 애니메이션 (무료)
- **R** - 통계 및 데이터 시각화 (무료)
- **Julia** - 과학 계산 (무료)
- **GNU Octave** - MATLAB 대체 (무료)
- **Gnuplot** - 그래프 플로팅 (무료)
- **Graphviz** - 다이어그램 생성 (무료)
- **Processing** - 인터랙티브 시각화 (무료)

### Node.js 패키지 설치

```bash
npm install
```

### 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 필수
OPENAI_API_KEY=your_openai_api_key
PORT=8000
PYTHON_PATH=python

# 선택 (비디오 생성용)
FFMPEG_PATH=ffmpeg

# 선택 (추가 프로그램 사용 시)
# MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe
# BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe
# R_PATH=C:\Program Files\R\R-4.3.0\bin\Rscript.exe
# JULIA_PATH=C:\Users\YourName\AppData\Local\Programs\Julia-1.9.0\bin\julia.exe
# 기타 프로그램들도 SETUP_PROGRAMS.md 참고
```

**빠른 시작 가이드**: `QUICK_START.md` 또는 `WHAT_YOU_NEED_TO_KNOW.md` 참고

### 서버 실행

```bash
npm start
# 또는 개발 모드
npm run dev
```

서버는 `http://localhost:8000`에서 실행됩니다.

## 사용 방법

1. **대본 생성**: `/script` 페이지에서 채팅으로 대본 요구사항을 논의한 후 "Generate Script" 버튼 클릭
2. **시뮬레이션 생성**: `/simulation` 페이지에서 채팅으로 시뮬레이션 요구사항을 논의한 후 "Generate Simulation" 버튼 클릭
3. **비디오 생성**: `/video` 페이지에서 대본과 시뮬레이션을 결합하여 최종 비디오 생성

## 프로젝트 구조

```
├── server.js              # 메인 서버 파일
├── ai/
│   ├── LocalAIApi.js      # OpenAI API 클라이언트
│   └── PromptManager.js   # 프롬프트 관리 시스템
├── workers/
│   ├── script-generator.js    # 대본 생성 워커
│   ├── simulation-runner.js   # 시뮬레이션 실행 워커
│   └── video-composer.js      # 비디오 합성 워커
├── mcp/
│   └── connection.js      # MCP 연결 모듈
├── config/
│   └── prompts.json       # 시스템 프롬프트 설정
└── outputs/               # 생성된 파일 저장 디렉토리
    ├── scripts/
    ├── simulations/
    └── videos/
```

## 프롬프트 커스터마이징

`config/prompts.json` 파일을 수정하여 각 도구의 시스템 프롬프트를 커스터마이징할 수 있습니다.

## 문서

- **빠른 시작**: `QUICK_START.md` - 빠른 시작 가이드
- **필수 설정**: `WHAT_YOU_NEED_TO_KNOW.md` - 실제 작동에 필요한 설정 사항
- **프로그램 설정**: `SETUP_PROGRAMS.md` - 각 프로그램별 상세 설정 가이드
- **문제 해결**: `TROUBLESHOOTING.md` - 일반적인 문제 해결 방법
- **설정 체크리스트**: `SETUP_CHECKLIST.md` - 설정 체크리스트

## 라이선스

MIT

