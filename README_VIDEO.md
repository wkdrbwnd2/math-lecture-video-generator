# 비디오 생성 시스템 개선 가이드

## 개요

MoviePy 기반 고품질 비디오 생성 시스템으로 업그레이드되었습니다.

## 주요 기능

1. **대본 기반 자막**: 대본을 문장 단위로 파싱하여 자동 자막 생성
2. **TTS 음성 나레이션**: Google TTS를 사용한 한국어 음성 생성
3. **시뮬레이션 영상 삽입**: 생성된 시뮬레이션 영상을 비디오에 통합
4. **고품질 출력**: H.264 코덱, 8000k 비트레이트, 30fps

## 설치 방법

### 1. Python 의존성 설치

```bash
pip install -r requirements.txt
```

필요한 패키지:
- `moviepy==1.0.3`: 비디오 편집 라이브러리
- `gtts==2.5.0`: Google Text-to-Speech
- `pydub==0.25.1`: 오디오 처리

### 2. FFmpeg 설치 확인

MoviePy는 FFmpeg를 필요로 합니다. 이미 설치되어 있어야 합니다.

### 3. Python 경로 설정 (선택사항)

환경 변수로 Python 경로를 지정할 수 있습니다:

```bash
# Windows
set PYTHON_PATH=python

# Linux/Mac
export PYTHON_PATH=python3
```

## 사용 방법

### 자동 사용

비디오 생성 페이지에서 "Generate" 버튼을 클릭하면 자동으로 MoviePy를 사용합니다.

### 수동 실행 (테스트용)

```bash
python workers/video_composer.py <script_path> <simulation_video_path> <output_dir> [temp_dir] [options_json]
```

예시:
```bash
python workers/video_composer.py \
  outputs/scripts/script_123.txt \
  outputs/simulations/simulation_123.mp4 \
  outputs/videos \
  outputs/temp \
  '{"lang":"ko","fontsize":40}'
```

## 옵션

JSON 형식으로 옵션을 전달할 수 있습니다:

```json
{
  "lang": "ko",              // TTS 언어 (기본: "ko")
  "fontsize": 40,            // 자막 폰트 크기 (기본: 40)
  "subtitle_position": "bottom",  // 자막 위치: "bottom", "top", "center" (기본: "bottom")
  "subtitle_color": "white"      // 자막 색상 (기본: "white")
}
```

## 작동 방식

1. **대본 파싱**: 대본 파일을 문장 단위로 분할
2. **TTS 생성**: 각 문장에 대해 Google TTS로 음성 생성
3. **자막 생성**: 각 문장에 대해 자막 클립 생성 (배경 포함)
4. **비디오 합성**: 
   - 시뮬레이션 비디오를 필요한 길이로 조정
   - 오디오 트랙 추가
   - 자막 오버레이 추가
5. **렌더링**: 최종 비디오 파일 생성

## 문제 해결

### Python을 찾을 수 없음

```
error: Python 실행 오류: spawn python3 ENOENT
```

**해결책**: 
- Python이 설치되어 있는지 확인
- `PYTHON_PATH` 환경 변수 설정
- Windows에서는 `python` 또는 `py` 사용

### MoviePy 설치 오류

```
ModuleNotFoundError: No module named 'moviepy'
```

**해결책**:
```bash
pip install moviepy gtts pydub
```

### TTS 생성 실패

인터넷 연결이 필요합니다. Google TTS는 온라인 서비스를 사용합니다.

### 비디오 생성이 너무 느림

- TTS 생성 시간이 포함됩니다
- 긴 대본의 경우 시간이 오래 걸릴 수 있습니다
- 타임아웃은 30분으로 설정되어 있습니다

## Fallback

Python 스크립트를 찾을 수 없거나 실행에 실패하면, 기존 FFmpeg 방식으로 자동 전환됩니다.

## 향후 개선 사항

- [ ] 오프라인 TTS 옵션 (pyttsx3)
- [ ] 더 많은 전환 효과
- [ ] 배경 음악 추가
- [ ] 여러 시뮬레이션 영상 삽입
- [ ] 진행 상황 실시간 표시 (WebSocket)











