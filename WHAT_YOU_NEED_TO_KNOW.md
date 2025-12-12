# 실제로 작동하는데 필요한 설정 사항 📋

## ✅ 필수 설정 (지금 바로 해야 함)

### 1. Python 패키지 설치 ⚠️

시뮬레이션 기능을 사용하려면 다음 패키지가 필요합니다:

```powershell
pip install matplotlib numpy plotly scipy pandas
```

**확인:**
```powershell
python -c "import matplotlib; import numpy; import plotly; import scipy; print('All OK!')"
```

### 2. .env 파일 설정 ⚠️

프로젝트 루트에 `.env` 파일이 있어야 합니다. 최소한 다음 내용이 필요합니다:

```env
OPENAI_API_KEY=your-api-key-here
PORT=8000
PYTHON_PATH=python
```

**현재 상태 확인:**
- `.env` 파일이 있는지 확인
- `OPENAI_API_KEY`가 올바르게 설정되어 있는지 확인

---

## 🎯 선택적 설정 (원하는 기능에 따라)

### 비디오 생성 기능 사용 시
```powershell
# FFmpeg 설치 (Chocolatey 사용)
choco install ffmpeg

# 또는 수동 설치 후 .env에 경로 추가
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
```

### 추가 프로그램 사용 시

더 많은 프로그램을 사용할 수 있습니다. 각 프로그램의 설치 방법은 `SETUP_PROGRAMS.md`를 참고하세요.

**지원 프로그램:**
- Python (기본, 필수)
- MATLAB (유료, 라이선스 필요)
- Blender (무료)
- R (무료)
- Julia (무료)
- GNU Octave (무료)
- Gnuplot (무료)
- Graphviz (무료)
- Processing (무료)

**프로그램 추가 방법:**
1. 프로그램 설치
2. `.env` 파일에 경로 추가
3. 프롬프트에서 프로그램 이름 언급

예: "R로 통계 그래프 만들어줘"

---

## 🚀 빠른 시작

### 최소 설정으로 시작하기

1. **Python 패키지 설치:**
   ```powershell
   pip install matplotlib numpy plotly scipy pandas
   ```

2. **.env 파일 확인:**
   - 파일이 있는지 확인
   - `OPENAI_API_KEY` 설정 확인

3. **서버 실행:**
   ```powershell
   npm start
   ```

4. **브라우저에서 테스트:**
   - `http://localhost:8000` 접속
   - `/simulation` 페이지에서 테스트

### 테스트 예시

1. `/simulation` 페이지 접속
2. "파이썬으로 sin 함수 그래프 만들어줘" 입력
3. 채팅 몇 번 주고받기
4. "🔬 Generate Simulation" 버튼 클릭
5. 코드 생성 및 실행 결과 확인

---

## 📚 상세 가이드

- **빠른 시작**: `QUICK_START.md`
- **프로그램 설정**: `SETUP_PROGRAMS.md`
- **문제 해결**: `TROUBLESHOOTING.md`
- **전체 설정 체크리스트**: `SETUP_CHECKLIST.md`

---

## ⚠️ 주의사항

### OpenAI API 키
- `.env` 파일에 올바른 API 키가 설정되어 있어야 합니다
- API 할당량이 초과되면 오류가 발생합니다
- 할당량 확인: https://platform.openai.com/usage

### Python 패키지
- Python 3.6 이상 필요
- 모든 패키지가 설치되어 있어야 시뮬레이션이 작동합니다

### 프로그램 경로
- `.env` 파일의 경로는 실제 설치 경로와 일치해야 합니다
- Windows에서는 백슬래시(`\`)를 사용하거나 슬래시(`/`)를 사용할 수 있습니다

---

## 🔍 현재 상태 확인

### Python 확인
```powershell
python --version
python -c "import matplotlib; print('OK')"
```

### .env 파일 확인
```powershell
# PowerShell에서
Get-Content .env | Select-Object -First 3
```

### 서버 실행 확인
```powershell
npm start
# 브라우저에서 http://localhost:8000 접속
```

---

## 💡 팁

1. **프로그램 자동 감지**: 프롬프트에서 프로그램 이름을 언급하면 자동으로 감지됩니다
   - 예: "R로", "Julia를 사용해서", "MATLAB으로"

2. **여러 프로그램 사용**: 각 프로그램은 독립적으로 사용할 수 있습니다
   - Python만 설치해도 기본 기능 사용 가능
   - 필요에 따라 다른 프로그램 추가 설치

3. **오류 발생 시**: 
   - 로그 확인 (서버 콘솔 출력)
   - `TROUBLESHOOTING.md` 참고
   - 프로그램이 올바르게 설치되어 있는지 확인

---

## ✅ 체크리스트

- [ ] Python 패키지 설치 (`pip install matplotlib numpy plotly scipy pandas`)
- [ ] `.env` 파일 생성 및 OpenAI API 키 설정
- [ ] 서버 실행 테스트 (`npm start`)
- [ ] `/simulation` 페이지에서 기본 테스트
- [ ] (선택) FFmpeg 설치 (비디오 생성용)
- [ ] (선택) 추가 프로그램 설치 및 설정

---

## 🎉 완료!

모든 설정이 완료되면 다양한 프로그램으로 시뮬레이션을 생성할 수 있습니다!

**지원하는 작업:**
- 수학 함수 그래프
- 통계 시각화
- 3D 애니메이션
- 다이어그램 생성
- 과학 계산 시뮬레이션
- 그리고 더 많은 것들!

