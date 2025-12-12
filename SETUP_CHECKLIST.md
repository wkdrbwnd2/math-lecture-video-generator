# 설정 체크리스트 ✅

현재 상태를 확인하고 필요한 설정을 완료하세요.

## ✅ 이미 완료된 것

- ✅ Node.js 설치됨
- ✅ npm 패키지 설치됨
- ✅ Python 3.6.8 설치됨

## ⚠️ 해야 할 일

### 1. Python 패키지 설치 (필수)

Python 시뮬레이션을 사용하려면 다음 패키지가 필요합니다:

```powershell
pip install matplotlib numpy plotly scipy
```

**확인 방법:**
```powershell
python -c "import matplotlib; import numpy; import plotly; import scipy; print('All packages installed!')"
```

### 2. FFmpeg 설치 (비디오 생성용, 선택)

비디오 생성 기능을 사용하려면 FFmpeg가 필요합니다.

**Windows 설치 방법:**

1. **Chocolatey 사용 (권장):**
   ```powershell
   choco install ffmpeg
   ```

2. **수동 설치:**
   - https://ffmpeg.org/download.html 에서 다운로드
   - 압축 해제 후 PATH에 추가
   - 또는 `.env` 파일에 경로 지정:
     ```env
     FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
     ```

**확인 방법:**
```powershell
ffmpeg -version
```

### 3. .env 파일 생성 (필수)

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# OpenAI API 키 (필수)
OPENAI_API_KEY=sk-proj-your-api-key-here

# 서버 포트 (선택, 기본값: 8000)
PORT=8000

# Python 경로 (선택, 기본값: python)
PYTHON_PATH=python

# FFmpeg 경로 (비디오 생성용, 선택)
FFMPEG_PATH=ffmpeg

# MATLAB 경로 (MATLAB 사용 시, 선택)
# MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe

# Blender 경로 (Blender 사용 시, 선택)
# BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe

# 세션 시크릿 (보안용, 선택)
SESSION_SECRET=your-random-secret-string-here
```

### 4. MATLAB 설치 (선택)

MATLAB 시뮬레이션을 사용하려면:
- MATLAB 설치: https://www.mathworks.com/products/matlab.html
- 라이선스 필요
- `.env` 파일에 경로 추가

### 5. Blender 설치 (선택)

Blender 3D 시뮬레이션을 사용하려면:
- Blender 다운로드: https://www.blender.org/download/
- 무료 오픈소스
- `.env` 파일에 경로 추가

## 빠른 시작 가이드

### 최소 설정 (Python만 사용)

1. Python 패키지 설치:
   ```powershell
   pip install matplotlib numpy plotly scipy
   ```

2. `.env` 파일 생성:
   ```env
   OPENAI_API_KEY=your-api-key-here
   ```

3. 서버 실행:
   ```powershell
   npm start
   ```

### 전체 기능 사용

1. 위의 최소 설정 완료
2. FFmpeg 설치
3. (선택) MATLAB 또는 Blender 설치
4. `.env` 파일에 모든 경로 설정

## 확인 명령어

```powershell
# Python 확인
python --version

# Python 패키지 확인
python -c "import matplotlib, numpy, plotly, scipy; print('OK')"

# FFmpeg 확인
ffmpeg -version

# Node.js 확인
node --version
npm --version

# 서버 실행
npm start
```

## 문제 해결

문제가 발생하면 `TROUBLESHOOTING.md` 파일을 참고하세요.

