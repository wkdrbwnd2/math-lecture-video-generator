# 비디오 생성 모델 옵션 가이드

## 현재 구현된 방식

### 1. **Hugging Face (로컬 실행)** ✅ 현재 사용 중
- **모델**: `cerspense/zeroscope_v2_576w`
- **방식**: Python diffusers 라이브러리로 로컬 실행
- **장점**:
  - 무료 (API 비용 없음)
  - 완전한 제어 가능
  - 프라이버시 보호 (데이터가 외부로 전송되지 않음)
- **단점**:
  - GPU 필요 (CPU는 매우 느림)
  - 로컬 리소스 사용
  - 설치 및 설정 복잡
  - 모델 다운로드 시간 소요
- **비용**: 무료 (하드웨어 비용 제외)
- **품질**: 중간 (576x320 해상도)

---

## 추가 가능한 옵션들

### 2. **Replicate API** ✅ 현재 구현됨 (옵션)
- **모델**: `anotherjesse/zeroscope-v2-xl`, 기타 text-to-video 모델들
- **방식**: 클라우드 API 호출
- **장점**:
  - GPU 없이 사용 가능
  - 빠른 시작 (설정 최소화)
  - 다양한 모델 선택 가능
  - 자동 스케일링
- **단점**:
  - API 비용 발생 ($0.01-0.10 per video)
  - 인터넷 연결 필요
  - 데이터가 외부로 전송됨
- **비용**: 사용량 기반 (월 $5-50 예상)
- **품질**: 중-고 (모델에 따라 다름)

**사용 가능한 Replicate 모델들:**
- `anotherjesse/zeroscope-v2-xl` - 고품질, 긴 비디오
- `stability-ai/stable-video-diffusion` - 안정적인 품질
- `luma/dream-machine` - 최신 모델
- `tencent/hunyuan-video` - 중국산 고품질 모델

---

### 3. **Stability AI (Stable Video Diffusion)**
- **모델**: Stable Video Diffusion 1.1
- **방식**: 
  - API: `https://api.stability.ai` (유료)
  - 로컬: Hugging Face에서 다운로드 가능
- **장점**:
  - 매우 안정적인 품질
  - 이미지-to-video 지원
  - 오픈소스 (로컬 실행 가능)
- **단점**:
  - API는 유료
  - 로컬 실행 시 GPU 필수
- **비용**: 
  - API: $0.08 per video
  - 로컬: 무료 (하드웨어 비용 제외)
- **품질**: 높음

**API 엔드포인트:**
```
POST https://api.stability.ai/v2beta/stable-video/generate
```

---

### 4. **Runway ML Gen-2 API**
- **모델**: Gen-2 (상용)
- **방식**: REST API
- **장점**:
  - 매우 높은 품질
  - 다양한 생성 모드 (text-to-video, image-to-video, video-to-video)
  - 상업적 사용 가능
- **단점**:
  - 비싼 가격
  - API 키 필요
  - 크레딧 시스템
- **비용**: $0.05-0.25 per second of video
- **품질**: 매우 높음

**API 엔드포인트:**
```
POST https://api.runwayml.com/v1/image-to-video
```

---

### 5. **Google Imagen Video / Veo**
- **모델**: Imagen Video, Veo 2
- **방식**: Google AI Studio API
- **장점**:
  - Google의 최신 기술
  - 높은 품질
  - Gemini API와 통합 가능
- **단점**:
  - 아직 제한적 접근 (대기 목록)
  - API 키 필요
  - 비용 불명확
- **비용**: 알 수 없음 (베타)
- **품질**: 매우 높음 (예상)

**현재 상태**: 베타/제한적 접근

---

### 6. **Meta Make-A-Video**
- **모델**: Make-A-Video
- **방식**: 
  - 연구용으로만 공개
  - Hugging Face에서 일부 구현체 존재
- **장점**:
  - Meta의 연구 결과
  - 오픈소스 구현체 존재
- **단점**:
  - 공식 API 없음
  - 로컬 실행만 가능
  - GPU 필수
- **비용**: 무료 (로컬 실행)
- **품질**: 중-고

---

### 7. **Hugging Face Inference API**
- **모델**: 다양한 모델들 (Zeroscope, AnimateDiff 등)
- **방식**: Hugging Face Inference API
- **장점**:
  - 다양한 모델 선택
  - 무료 티어 제공
  - 간단한 API
- **단점**:
  - 무료 티어 제한적
  - 큐 대기 시간
  - 일부 모델만 지원
- **비용**: 
  - 무료 티어: 제한적
  - 유료: $0.01-0.05 per request
- **품질**: 모델에 따라 다름

**API 엔드포인트:**
```
POST https://api-inference.huggingface.co/models/{model_id}
```

**사용 가능한 모델들:**
- `cerspense/zeroscope_v2_576w`
- `anotherjesse/zeroscope-v2-xl`
- `stabilityai/stable-video-diffusion-img2vid`

---

### 8. **AnimateDiff (로컬)**
- **모델**: AnimateDiff
- **방식**: 로컬 실행 (ComfyUI, Automatic1111)
- **장점**:
  - 이미지-to-video 변환
  - 커스터마이징 가능
  - 무료
- **단점**:
  - GPU 필수
  - 설정 복잡
  - API 없음 (로컬만)
- **비용**: 무료 (하드웨어 비용 제외)
- **품질**: 중-고

---

## 추천 조합

### **옵션 1: 비용 최소화 (현재 방식)**
- **주**: Hugging Face 로컬 (zeroscope_v2_576w)
- **보조**: Hugging Face Inference API (무료 티어)
- **비용**: 거의 무료
- **품질**: 중간

### **옵션 2: 품질과 비용 균형**
- **주**: Replicate API (zeroscope-v2-xl)
- **보조**: Hugging Face 로컬 (fallback)
- **비용**: 월 $10-30
- **품질**: 중-고

### **옵션 3: 최고 품질**
- **주**: Runway ML Gen-2
- **보조**: Stability AI API
- **비용**: 월 $50-200
- **품질**: 매우 높음

### **옵션 4: 하이브리드 (추천)**
- **1순위**: Hugging Face 로컬 (GPU 있을 때)
- **2순위**: Replicate API (로컬 실패 시)
- **3순위**: Hugging Face Inference API (무료 티어)
- **비용**: 월 $5-20
- **품질**: 중-고

---

## 구현 우선순위

1. **Hugging Face Inference API 추가** (쉬움, 빠름)
   - 현재 Hugging Face 로컬과 유사한 모델 사용
   - API 키만 추가하면 됨
   - 무료 티어로 시작 가능

2. **Stability AI API 추가** (중간 난이도)
   - 안정적인 품질
   - 이미지-to-video 지원
   - API 문서 잘 되어 있음

3. **Replicate API 개선** (이미 구현됨)
   - 더 많은 모델 옵션 추가
   - 모델 자동 선택 로직

4. **Runway ML Gen-2** (고난이도, 비용)
   - 최고 품질이지만 비용 높음
   - 상업적 사용 시 고려

---

## 다음 단계

어떤 옵션을 구현할지 결정해주세요:
1. Hugging Face Inference API 추가
2. Stability AI API 추가
3. Replicate API 모델 확장
4. 여러 옵션을 자동으로 시도하는 fallback 시스템



