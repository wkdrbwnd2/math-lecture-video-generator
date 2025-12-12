# 시뮬레이션 도구 설정 가이드

시뮬레이션 도구는 Python, MATLAB, Blender를 지원합니다.

## Python 설정 (기본)

### 설치 확인
```bash
python --version
# 또는
python3 --version
```

### 필요한 패키지 설치
```bash
pip install matplotlib numpy plotly scipy
```

### 환경 변수 설정 (.env)
```env
PYTHON_PATH=python
# 또는
PYTHON_PATH=python3
```

## MATLAB 설정

### 설치
1. MATLAB을 설치합니다 (https://www.mathworks.com/products/matlab.html)
2. MATLAB 라이선스가 필요합니다

### 환경 변수 설정 (.env)
```env
# Windows 예시
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe

# Linux/Mac 예시
MATLAB_PATH=/usr/local/MATLAB/R2023b/bin/matlab
```

### MATLAB Batch 모드 사용
MATLAB은 `-batch` 옵션으로 스크립트를 실행할 수 있습니다:
```bash
matlab -batch "run('script.m')"
```

### MATLAB Engine API (선택사항)
Python에서 MATLAB을 직접 제어하려면:
```bash
pip install matlabengine
```

## Blender 설정

### 설치
1. Blender를 다운로드합니다 (https://www.blender.org/download/)
2. 무료 오픈소스입니다

### 환경 변수 설정 (.env)
```env
# Windows 예시
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe

# Linux 예시
BLENDER_PATH=/usr/bin/blender

# Mac 예시
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender
```

### Blender 헤드리스 모드
Blender는 `--background` 옵션으로 GUI 없이 실행할 수 있습니다:
```bash
blender --background --python script.py
```

## 프로그램 자동 감지

시뮬레이션 도구는 사용자의 프롬프트를 분석하여 적절한 프로그램을 자동으로 선택합니다:

- **Python**: "python", "matplotlib", "numpy", "plotly" 등의 키워드
- **MATLAB**: "matlab", "simulink" 등의 키워드
- **Blender**: "blender", "3d", "animation", "rendering" 등의 키워드

## 사용 예시

### Python 시뮬레이션
```
사용자: "파이썬으로 sin 함수 그래프를 애니메이션으로 만들어줘"
→ Python 코드 생성 및 실행
```

### MATLAB 시뮬레이션
```
사용자: "MATLAB으로 신호 처리를 시뮬레이션해줘"
→ MATLAB 스크립트 생성 및 실행
```

### Blender 시뮬레이션
```
사용자: "Blender로 3D 애니메이션을 만들어줘"
→ Blender Python 스크립트 생성 및 실행
```

## 문제 해결

### MATLAB이 실행되지 않는 경우
- MATLAB 경로가 올바른지 확인
- MATLAB 라이선스가 활성화되어 있는지 확인
- `matlab -batch` 명령이 작동하는지 테스트

### Blender가 실행되지 않는 경우
- Blender 경로가 올바른지 확인
- Blender가 설치되어 있는지 확인
- `blender --version` 명령이 작동하는지 테스트

### 출력 파일이 생성되지 않는 경우
- 각 프로그램의 출력 경로 설정 확인
- 파일 권한 확인
- 로그(stdout/stderr) 확인

