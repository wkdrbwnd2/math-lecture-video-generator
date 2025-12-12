# 클라우드 설정 완료 가이드 - 완전 클라우드 버전

Railway 배포 + GNU Octave 조합으로 완전 클라우드 구성하는 전체 가이드입니다.

## 📋 전체 체크리스트

### 1단계: Railway 배포 (Python + Octave + Manim)

- [ ] Railway 계정 생성 (https://railway.app)
- [ ] GitHub 저장소 연결
- [ ] Python MCP 서버 배포
- [ ] Octave MCP 서버 배포 (MATLAB 대체)
- [ ] Manim MCP 서버 배포
- [ ] Public URL 확인 및 복사

**예상 시간**: 30-40분

---

### 2단계: 로컬 설정

- [ ] `.env` 파일 업데이트
- [ ] 패키지 설치 (`npm install`)
- [ ] 메인 서버 실행 (`npm start`)

**예상 시간**: 5분

**참고**: 모든 MCP 서버는 Railway에서 실행되므로 로컬 설치 불필요!

---

## 🔧 상세 설정

### .env 파일 최종 설정

```env
# MCP 모드 활성화
USE_MCP_SIMULATION=true

# Railway 배포된 서버 (Public URL로 변경)
PYTHON_MCP_ENDPOINT=https://your-python-mcp.railway.app
OCTAVE_MCP_ENDPOINT=https://your-octave-mcp.railway.app
MANIM_MCP_ENDPOINT=https://your-manim-mcp.railway.app
```

---

## 🚀 실행 순서

### 1. Railway 서버 확인
```bash
# Health check
curl https://your-python-mcp.railway.app/health
curl https://your-octave-mcp.railway.app/health
curl https://your-manim-mcp.railway.app/health
```

### 2. 메인 서버 실행
```bash
npm start
```

**참고**: MCP 서버들은 Railway에서 자동 실행되므로 로컬에서 실행할 필요 없음!

---

## ✅ 최종 확인

1. **브라우저에서 접속**: `http://localhost:8000/simulation`
2. **시뮬레이션 요청**: "python으로 sin 그래프 만들어줘"
3. **확인**: Railway 서버를 통해 실행되는지 로그 확인

---

## 💰 총 비용

- **Railway**: 무료 티어 ($5 크레딧/월)
- **GNU Octave**: 완전 무료
- **총 비용**: $0 (무제한)

---

## ✅ 완전 클라우드 구성

- **로컬 설치 불필요**: 모든 프로그램이 Railway에서 실행
- **완전 무료**: GNU Octave 사용으로 비용 없음
- **자동 스케일링**: Railway가 자동으로 관리
- **어디서나 접근**: 인터넷만 있으면 어디서나 사용 가능

---

## 📞 문제 해결

### Railway 서버가 응답하지 않는 경우
- Railway 대시보드에서 로그 확인
- 환경 변수 확인
- Public URL이 올바른지 확인

### Octave가 실행되지 않는 경우
- Railway 로그에서 Octave 설치 확인
- 환경 변수 `OCTAVE_PATH=octave` 확인
- Health check 엔드포인트 테스트

---

## 📚 참고 문서

- `RAILWAY_DEPLOYMENT_GUIDE.md` - Railway 배포 상세 가이드
- `SETUP_CLOUD.md` - 사용자용 설정 가이드
- `MCP_IMPLEMENTATION_GUIDE.md` - 전체 구현 가이드
