# MCP Servers

각 프로그램(Python, MATLAB, Manim)을 원격으로 실행하기 위한 MCP 서버들입니다.

## 구조

각 서버는 독립적인 Express 서버로 실행되며, HTTP API를 통해 코드를 받아서 실행하고 결과를 반환합니다.

## 실행 방법

### 개별 실행
```bash
npm run mcp:python   # Python MCP 서버 (포트 8001)
npm run mcp:matlab   # MATLAB MCP 서버 (포트 8002)
npm run mcp:manim    # Manim MCP 서버 (포트 8004)
```

### 모두 실행
```bash
npm run mcp:all
```

## 환경 변수 설정

`.env` 파일에 다음 변수들을 설정하세요:

```env
# MCP 모드 활성화
USE_MCP_SIMULATION=true

# 각 프로그램별 MCP 서버 엔드포인트
PYTHON_MCP_ENDPOINT=http://localhost:8001
MATLAB_MCP_ENDPOINT=http://localhost:8002
MANIM_MCP_ENDPOINT=http://localhost:8004

# 각 MCP 서버의 포트 (선택사항)
PYTHON_MCP_PORT=8001
MATLAB_MCP_PORT=8002
MANIM_MCP_PORT=8004

# 각 프로그램의 실행 경로
PYTHON_PATH=python
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe

# 출력 디렉토리 (선택사항)
SIMULATION_OUTPUT_DIR=outputs/simulations
```

## API 엔드포인트

### Health Check
```
GET /health
```

### Execute Code
```
POST /execute
Content-Type: application/json

{
  "code": "print('Hello World')",
  "options": {}
}
```

## 사용 방법

1. MCP 서버들을 실행합니다 (`npm run mcp:all`)
2. 메인 서버를 실행합니다 (`npm start`)
3. `/simulation` 페이지에서 시뮬레이션을 생성하면 자동으로 MCP 서버를 통해 실행됩니다.

## 원격 서버 배포

각 MCP 서버를 별도 서버에 배포하려면:

1. 각 서버에 프로그램 설치 (Python, MATLAB, Manim)
2. MCP 서버 실행
3. `.env` 파일에서 엔드포인트를 원격 URL로 변경:
   ```env
   PYTHON_MCP_ENDPOINT=http://remote-server-1:8001
   MATLAB_MCP_ENDPOINT=http://remote-server-2:8002
   MANIM_MCP_ENDPOINT=http://remote-server-3:8004
   ```

