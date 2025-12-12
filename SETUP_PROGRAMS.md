# 프로그램 설정 가이드

시뮬레이션 도구에서 사용할 수 있는 모든 프로그램의 설치 및 설정 방법입니다.

## 지원 프로그램 목록

1. **Python** (기본, 필수)
2. **MATLAB** (선택)
3. **Blender** (선택)
4. **R** (선택)
5. **Julia** (선택)
6. **GNU Octave** (선택)
7. **Gnuplot** (선택)
8. **Graphviz** (선택)
9. **Processing** (선택)

---

## 1. Python (필수)

### 설치 확인
```powershell
python --version
```

### 필요한 패키지 설치
```powershell
pip install matplotlib numpy plotly scipy pandas
```

### 환경 변수 설정 (.env)
```env
PYTHON_PATH=python
# 또는 전체 경로
# PYTHON_PATH=C:\Python39\python.exe
```

---

## 2. MATLAB (선택)

### 설치
- 다운로드: https://www.mathworks.com/products/matlab.html
- 라이선스 필요 (유료)

### 환경 변수 설정 (.env)
```env
# Windows 예시
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe

# Linux/Mac 예시
MATLAB_PATH=/usr/local/MATLAB/R2023b/bin/matlab
```

### 확인
```powershell
matlab -batch "disp('MATLAB is working')"
```

---

## 3. Blender (선택)

### 설치
- 다운로드: https://www.blender.org/download/
- 무료 오픈소스

### 환경 변수 설정 (.env)
```env
# Windows 예시
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe

# Linux 예시
BLENDER_PATH=/usr/bin/blender

# Mac 예시
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender
```

### 확인
```powershell
blender --version
```

---

## 4. R (선택)

### 설치
- 다운로드: https://cran.r-project.org/
- 무료 오픈소스

### 필요한 패키지 설치
R을 실행한 후:
```r
install.packages(c("ggplot2", "plotly", "animation", "gganimate"))
```

### 환경 변수 설정 (.env)
```env
# Windows 예시
R_PATH=C:\Program Files\R\R-4.3.0\bin\Rscript.exe

# Linux/Mac 예시
R_PATH=/usr/bin/Rscript
```

### 확인
```powershell
Rscript --version
```

---

## 5. Julia (선택)

### 설치
- 다운로드: https://julialang.org/downloads/
- 무료 오픈소스

### 필요한 패키지 설치
Julia를 실행한 후:
```julia
using Pkg
Pkg.add(["Plots", "PlotlyJS", "DifferentialEquations", "Animations"])
```

### 환경 변수 설정 (.env)
```env
# Windows 예시
JULIA_PATH=C:\Users\YourName\AppData\Local\Programs\Julia-1.9.0\bin\julia.exe

# Linux/Mac 예시
JULIA_PATH=/usr/local/bin/julia
```

### 확인
```powershell
julia --version
```

---

## 6. GNU Octave (선택)

### 설치
- 다운로드: https://www.gnu.org/software/octave/download
- 무료 오픈소스 (MATLAB 대체)

### 환경 변수 설정 (.env)
```env
# Windows 예시
OCTAVE_PATH=C:\Octave\Octave-8.2.0\mingw64\bin\octave.exe

# Linux 예시
OCTAVE_PATH=/usr/bin/octave

# Mac 예시
OCTAVE_PATH=/usr/local/bin/octave
```

### 확인
```powershell
octave --version
```

---

## 7. Gnuplot (선택)

### 설치
- 다운로드: https://sourceforge.net/projects/gnuplot/
- 무료 오픈소스

### 환경 변수 설정 (.env)
```env
# Windows 예시
GNUPLOT_PATH=C:\Program Files\gnuplot\bin\gnuplot.exe

# Linux 예시
GNUPLOT_PATH=/usr/bin/gnuplot

# Mac 예시
GNUPLOT_PATH=/usr/local/bin/gnuplot
```

### 확인
```powershell
gnuplot --version
```

---

## 8. Graphviz (선택)

### 설치
- 다운로드: https://graphviz.org/download/
- 무료 오픈소스

### 환경 변수 설정 (.env)
```env
# Windows 예시
GRAPHVIZ_PATH=C:\Program Files\Graphviz\bin\dot.exe

# Linux 예시
GRAPHVIZ_PATH=/usr/bin/dot

# Mac 예시
GRAPHVIZ_PATH=/usr/local/bin/dot
```

### 확인
```powershell
dot -V
```

---

## 9. Processing (선택)

### 설치
- 다운로드: https://processing.org/download
- 무료 오픈소스

### 환경 변수 설정 (.env)
```env
# Windows 예시
PROCESSING_PATH=C:\Program Files\Processing\processing-java.exe

# Linux/Mac 예시
PROCESSING_PATH=/usr/local/bin/processing-java
```

### 확인
```powershell
processing-java --version
```

---

## 전체 .env 예시

```env
# 필수
OPENAI_API_KEY=your-api-key-here
PORT=8000
PYTHON_PATH=python

# 선택 (사용할 프로그램만 추가)
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe
BLENDER_PATH=C:\Program Files\Blender Foundation\Blender 4.0\blender.exe
R_PATH=C:\Program Files\R\R-4.3.0\bin\Rscript.exe
JULIA_PATH=C:\Users\YourName\AppData\Local\Programs\Julia-1.9.0\bin\julia.exe
OCTAVE_PATH=C:\Octave\Octave-8.2.0\mingw64\bin\octave.exe
GNUPLOT_PATH=C:\Program Files\gnuplot\bin\gnuplot.exe
GRAPHVIZ_PATH=C:\Program Files\Graphviz\bin\dot.exe
PROCESSING_PATH=C:\Program Files\Processing\processing-java.exe

# 비디오 생성용
FFMPEG_PATH=ffmpeg
```

---

## 프로그램 자동 감지

시뮬레이션 도구는 사용자의 프롬프트를 분석하여 적절한 프로그램을 자동으로 선택합니다:

- **Python**: "python", "matplotlib", "numpy", "plotly" 등의 키워드
- **MATLAB**: "matlab", "simulink" 등의 키워드
- **Blender**: "blender", "3d", "animation", "rendering" 등의 키워드
- **R**: "r", "ggplot2", "statistics" 등의 키워드
- **Julia**: "julia", "differential equations", "pluto" 등의 키워드
- **Octave**: "octave", "matlab alternative" 등의 키워드
- **Gnuplot**: "gnuplot", "plotting" 등의 키워드
- **Graphviz**: "graphviz", "diagram", "flowchart" 등의 키워드
- **Processing**: "processing", "p5.js", "interactive" 등의 키워드

---

## 사용 예시

### Python 시뮬레이션
```
사용자: "파이썬으로 sin 함수 그래프를 애니메이션으로 만들어줘"
→ Python 코드 생성 및 실행
```

### R 시뮬레이션
```
사용자: "R로 통계 그래프를 만들어줘"
→ R 코드 생성 및 실행
```

### Julia 시뮬레이션
```
사용자: "Julia로 미분방정식을 시뮬레이션해줘"
→ Julia 코드 생성 및 실행
```

### Graphviz 다이어그램
```
사용자: "Graphviz로 플로우차트를 만들어줘"
→ Graphviz DOT 코드 생성 및 실행
```

---

## 문제 해결

### 프로그램이 실행되지 않는 경우
1. 프로그램이 설치되어 있는지 확인
2. `.env` 파일의 경로가 올바른지 확인
3. PATH 환경변수에 프로그램이 포함되어 있는지 확인
4. 프로그램이 실행 가능한지 직접 테스트

### 출력 파일이 생성되지 않는 경우
1. 각 프로그램의 출력 경로 설정 확인
2. 파일 권한 확인
3. 로그(stdout/stderr) 확인
4. 프로그램별 타임아웃 설정 확인

### 특정 프로그램만 사용하고 싶은 경우
프롬프트에서 원하는 프로그램을 명시적으로 언급하세요:
- "R로 만들어줘"
- "Julia를 사용해서"
- "MATLAB으로 시뮬레이션"

