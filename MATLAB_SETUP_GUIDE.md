# MATLAB 평가판 설정 가이드

MATLAB 평가판을 사용하여 MCP 서버를 실행하는 방법입니다.

## 📋 MATLAB 평가판 다운로드

1. **MATLAB 평가판 신청**
   - https://www.mathworks.com/campaigns/products/trials.html 접속
   - 평가판 신청 (30일 무료)

2. **다운로드 및 설치**
   - MathWorks 계정으로 로그인
   - MATLAB 설치 파일 다운로드
   - 설치 진행

---

## 🔧 로컬 설정

### 1단계: MATLAB 설치 확인

```powershell
# PowerShell에서 확인
& "C:\Program Files\MATLAB\R2023b\bin\matlab.exe" -batch "disp('MATLAB is working')"
```

### 2단계: 환경 변수 설정

`.env` 파일에 추가:

```env
# MATLAB MCP 서버 (로컬 실행)
MATLAB_MCP_ENDPOINT=http://localhost:8002
MATLAB_PATH=C:\Program Files\MATLAB\R2023b\bin\matlab.exe
MATLAB_MCP_PORT=8002
```

### 3단계: MCP 서버 실행

```bash
npm run mcp:matlab
```

---

## 🌐 원격 서버 배포 (선택사항)

MATLAB을 원격 서버에 설치하고 MCP 서버를 배포할 수도 있습니다.

### Railway에 배포 (주의: MATLAB 라이선스 필요)

1. Railway에 MATLAB이 설치된 Docker 이미지 사용
2. 또는 MATLAB이 설치된 서버에 MCP 서버 배포

**주의**: MATLAB 라이선스가 원격 서버에서도 작동해야 합니다.

---

## ✅ 테스트

MATLAB MCP 서버가 정상 작동하는지 확인:

```bash
# Health check
curl http://localhost:8002/health

# 또는 브라우저에서
http://localhost:8002/health
```

---

## 📝 평가판 제한사항

- **기간**: 30일
- **기능**: 전체 기능 사용 가능
- **연장**: 평가판 연장 불가 (정식 라이선스 필요)

---

## 🔄 평가판 만료 후

1. **정식 라이선스 구매** ($2,150/년)
2. **학생용 라이선스** ($99/년)
3. **GNU Octave 사용** (무료, MATLAB 호환)

---

## 💡 팁

- 평가판 기간 동안 충분히 테스트하세요
- 필요시 GNU Octave로 전환 가능 (코드 호환)
- MATLAB Online도 고려 가능 (유료)



