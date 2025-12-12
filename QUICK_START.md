# 빠른 시작 가이드 🚀

## 지금 바로 해야 할 일

### 1. Python 패키지 설치 (필수) ⚠️

시뮬레이션 기능을 사용하려면 다음 패키지가 필요합니다:

```powershell
pip install matplotlib numpy plotly scipy
```

**확인:**
```powershell
python -c "import matplotlib; import numpy; import plotly; import scipy; print('All OK!')"
```

### 2. .env 파일 생성 (필수) ⚠️

프로젝트 루트에 `.env` 파일을 만들고 다음 내용을 추가하세요:

```env
OPENAI_API_KEY=sk-proj-your-api-key-here
PORT=8000
PYTHON_PATH=python
```

**파일 생성 방법:**
1. 프로젝트 폴더에서 새 파일 생성
2. 이름: `.env` (점으로 시작)
3. 위 내용 복사해서 붙여넣기
4. `your-api-key-here` 부분을 실제 OpenAI API 키로 변경

### 3. FFmpeg 설치 (비디오 생성용, 선택)

비디오 생성 기능을 사용하려면:

**Chocolatey 사용 (가장 쉬움):**
```powershell
choco install ffmpeg
```

**또는 수동 설치:**
- https://ffmpeg.org/download.html 에서 다운로드
- 설치 후 `.env` 파일에 경로 추가:
  ```env
  FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
  ```

### 4. 서버 실행

```powershell
npm start
```

브라우저에서 `http://localhost:8000` 접속

## 선택 사항

### 추가 프로그램 사용하기

더 많은 프로그램을 사용할 수 있습니다. 자세한 설정 방법은 `SETUP_PROGRAMS.md`를 참고하세요.

**지원 프로그램:**
- **MATLAB** - 수학 시뮬레이션 (라이선스 필요)
- **Blender** - 3D 애니메이션 (무료)
- **R** - 통계 및 데이터 시각화 (무료)
- **Julia** - 과학 계산 (무료)
- **GNU Octave** - MATLAB 대체 (무료)
- **Gnuplot** - 그래프 플로팅 (무료)
- **Graphviz** - 다이어그램 생성 (무료)
- **Processing** - 인터랙티브 시각화 (무료)

**예시 설정 (.env):**
```env
# MATLAB
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe

# Blender
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe

# R
R_PATH=C:\Program Files\R\R-4.3.0\bin\Rscript.exe

# Julia
JULIA_PATH=C:\Users\YourName\AppData\Local\Programs\Julia-1.9.0\bin\julia.exe

# 기타 프로그램들도 SETUP_PROGRAMS.md 참고
```

## 체크리스트

- [ ] Python 패키지 설치 (`pip install matplotlib numpy plotly scipy`)
- [ ] `.env` 파일 생성 및 OpenAI API 키 설정
- [ ] (선택) FFmpeg 설치
- [ ] (선택) MATLAB 설치
- [ ] (선택) Blender 설치
- [ ] 서버 실행 (`npm start`)

## 테스트

설정이 완료되면:

1. 서버 실행: `npm start`
2. 브라우저에서 `http://localhost:8000` 접속
3. `/simulation` 페이지에서 테스트:
   - "파이썬으로 sin 함수 그래프 만들어줘" 입력
   - 채팅 몇 번 주고받기
   - "Generate Simulation" 버튼 클릭

## 문제 발생 시

- `TROUBLESHOOTING.md` 참고
- Python 패키지 오류: `pip install --upgrade matplotlib numpy plotly scipy`
- FFmpeg 오류: 경로 확인 및 PATH 환경변수 설정

