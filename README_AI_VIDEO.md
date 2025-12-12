# AI 비디오 생성 시스템 가이드

## 개요

**Replicate API 기반** AI 비디오 생성 기능이 추가되었습니다. 텍스트 프롬프트에서 직접 비디오를 생성할 수 있으며, GPU 없이도 클라우드에서 처리됩니다.

> ⚠️ **중요**: 이제 로컬 Python 스크립트 대신 Replicate API를 사용합니다. 설정 방법은 [README_REPLICATE.md](./README_REPLICATE.md)를 참조하세요.

## 주요 기능

1. **텍스트에서 비디오 생성**: Zeroscope, ModelScope 등 Hugging Face 모델 사용
2. **대본 기반 자동 생성**: 대본에서 자동으로 비디오 프롬프트 추출
3. **하이브리드 비디오**: 시뮬레이션 비디오와 AI 비디오를 함께 합성
4. **다양한 모델 지원**: 여러 Hugging Face 비디오 생성 모델 선택 가능

## 설치 방법

### 1. Python 의존성 설치

```bash
pip install -r requirements.txt
```

추가로 필요한 패키지:
- `diffusers>=0.21.0`: Hugging Face diffusion 모델
- `transformers>=4.35.0`: Transformers 라이브러리
- `torch>=2.0.0`: PyTorch (GPU 지원 권장)
- `accelerate>=0.24.0`: 모델 가속화
- `xformers>=0.0.22`: 메모리 최적화 (선택사항)
- `opencv-python>=4.8.0`: 비디오 처리

### 2. GPU 설정 (권장)

GPU가 있으면 자동으로 사용됩니다. CPU만 있어도 작동하지만 느릴 수 있습니다.

```bash
# CUDA 설치 확인
python -c "import torch; print(torch.cuda.is_available())"
```

## 사용 방법

### 1. AI 비디오 생성 페이지

`http://localhost:8000/ai-video` 접속

### 2. 대본 기반 생성

1. 먼저 Script 도구로 대본 생성
2. AI Video 페이지에서 채팅 시작
3. "Generate" 버튼 클릭
4. 시스템이 자동으로 대본을 찾아 AI 비디오 생성

### 3. 직접 프롬프트 입력

AI Video 페이지에서 비디오 설명을 입력:
- "A beautiful sunset over the ocean with waves"
- "A mathematical graph showing sine wave animation"
- "A 3D rotating cube with mathematical equations"

## 지원 모델

### Zeroscope v2 (기본)
- 모델: `cerspense/zeroscope_v2_576w`
- 해상도: 576x320
- 프레임: 24프레임 (약 3초)
- 특징: 빠른 생성, 좋은 품질

### Zeroscope v2 XL
- 모델: `cerspense/zeroscope_v2_XL`
- 해상도: 더 높은 해상도
- 특징: 더 높은 품질, 더 느린 생성

### ModelScope
- 모델: `damo-vilab/modelscope-damo-text-to-video-synthesis`
- 특징: 텍스트-비디오 합성에 특화

## API 옵션

비디오 생성 시 다음 옵션을 설정할 수 있습니다:

```javascript
{
  "model": "cerspense/zeroscope_v2_576w",  // 사용할 모델
  "steps": 50,                              // 추론 스텝 수 (높을수록 품질↑, 시간↑)
  "frames": 24,                             // 프레임 수
  "height": 320,                            // 비디오 높이
  "width": 576,                             // 비디오 너비
  "guidanceScale": 7.5,                     // Guidance scale
  "device": "cuda"                          // Device (cuda/cpu)
}
```

## 하이브리드 비디오 생성

일반 비디오 생성(`/video`)에서 AI 비디오도 자동으로 생성하여 합성할 수 있습니다:

1. Script 생성
2. Simulation 생성
3. Video 생성 시 자동으로 AI 비디오도 생성되어 합성됨

## 문제 해결

### 모델 다운로드 오류

모델은 처음 실행 시 자동으로 다운로드됩니다. 인터넷 연결이 필요합니다.

```
# 모델 캐시 위치 (Windows)
C:\Users\<username>\.cache\huggingface\hub

# 모델 캐시 위치 (Linux/Mac)
~/.cache/huggingface/hub
```

### GPU 메모리 부족

CPU 모드로 전환하거나 더 작은 모델 사용:

```javascript
{
  "device": "cpu",
  "model": "cerspense/zeroscope_v2_576w"  // 더 작은 모델
}
```

### 생성 시간이 너무 오래 걸림

- GPU 사용 권장
- `steps` 값 줄이기 (기본: 50 → 30)
- `frames` 값 줄이기 (기본: 24 → 16)

### 비디오가 저장되지 않음

출력 디렉토리 확인:
```
outputs/ai-videos/
```

## 성능 최적화

### GPU 사용 시
- `xformers` 설치로 메모리 최적화
- `enable_model_cpu_offload()` 사용
- `enable_vae_slicing()` 사용

### CPU 사용 시
- `steps` 값 낮추기
- `frames` 값 낮추기
- 더 작은 모델 사용

## 향후 개선 사항

- [ ] 이미지에서 비디오 생성 (Stable Video Diffusion)
- [ ] 비디오 확장/연장 기능
- [ ] 여러 AI 비디오 클립 합성
- [ ] 실시간 생성 진행 상황 표시 (WebSocket)
- [ ] 프롬프트 최적화 자동화

## 참고 자료

- [Hugging Face Diffusers](https://huggingface.co/docs/diffusers)
- [Zeroscope 모델](https://huggingface.co/cerspense/zeroscope_v2_576w)
- [ModelScope 모델](https://huggingface.co/damo-vilab/modelscope-damo-text-to-video-synthesis)

