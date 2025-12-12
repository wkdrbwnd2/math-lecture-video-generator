# 해야 할 일 체크리스트 ✅

## 필수 작업 (지금 바로 해야 함)

### 1. Python 패키지 설치 ⚠️

현재 Python은 설치되어 있지만 필요한 패키지가 없습니다.

**실행:**
```powershell
pip install matplotlib numpy plotly scipy
```

**확인:**
```powershell
python -c "import matplotlib; import numpy; import plotly; import scipy; print('OK')"
```

### 2. .env 파일 확인 및 수정 ⚠️

`.env` 파일이 생성되었는지 확인하고, OpenAI API 키가 올바른지 확인하세요.

**확인:**
- 프로젝트 폴더에 `.env` 파일이 있는지 확인
- 파일 내용에 `OPENAI_API_KEY=` 가 있는지 확인
- API 키가 올바른지 확인

**필요한 내용:**
```env
OPENAI_API_KEY=sk-proj-your-key-here
PORT=8000
PYTHON_PATH=python
```

## 선택 작업 (원하는 기능에 따라)

### 3. FFmpeg 설치 (비디오 생성용)

비디오 생성 기능을 사용하려면 FFmpeg가 필요합니다.

**설치 방법:**

**옵션 A: Chocolatey 사용 (권장)**
```powershell
choco install ffmpeg
```

**옵션 B: 수동 설치**
1. https://ffmpeg.org/download.html 에서 다운로드
2. 압축 해제
3. `.env` 파일에 경로 추가:
   ```env
   FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
   ```

### 4. MATLAB 설치 (MATLAB 시뮬레이션용)

MATLAB 시뮬레이션을 사용하려면:
- MATLAB 설치 (라이선스 필요)
- `.env` 파일에 경로 추가:
  ```env
  MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe
  ```

### 5. Blender 설치 (3D 시뮬레이션용)

Blender 3D 시뮬레이션을 사용하려면:
- Blender 다운로드: https://www.blender.org/download/
- 무료 오픈소스
- `.env` 파일에 경로 추가:
  ```env
  BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe
  ```

## 빠른 테스트

설정 완료 후:

1. **서버 실행:**
   ```powershell
   npm start
   ```

2. **브라우저에서 접속:**
   - http://localhost:8000

3. **테스트:**
   - `/simulation` 페이지에서 "파이썬으로 sin 함수 그래프 만들어줘" 입력
   - 채팅 몇 번 주고받기
   - "Generate Simulation" 버튼 클릭

## 현재 상태

- ✅ Node.js 설치됨
- ✅ npm 패키지 설치됨  
- ✅ Python 3.6.8 설치됨
- ⚠️ Python 패키지 미설치 (matplotlib, numpy 등)
- ⚠️ FFmpeg 미설치
- ⚠️ .env 파일 확인 필요

## 우선순위

1. **최우선:** Python 패키지 설치 (`pip install matplotlib numpy plotly scipy`)
2. **필수:** `.env` 파일 확인 및 OpenAI API 키 설정
3. **선택:** FFmpeg 설치 (비디오 생성 기능 사용 시)
4. **선택:** MATLAB/Blender 설치 (해당 기능 사용 시)

