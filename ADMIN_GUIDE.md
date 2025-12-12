# 개발자 관리자 가이드

## 개발자 계정 설정

개발자 계정으로 로그인하면 AI 프롬프트 설정 페이지에 접근할 수 있습니다.

### 개발자 계정 조건

다음 중 하나를 만족하면 개발자로 인식됩니다:

1. **Username이 다음 중 하나인 경우:**
   - `admin`
   - `developer`
   - `dev`

2. **users 테이블에 `role` 필드가 있고 값이 다음 중 하나인 경우:**
   - `developer`
   - `admin`

### 개발자 계정 생성 방법

#### 방법 1: Username으로 구분 (간단)

데이터베이스에 username이 `admin`, `developer`, 또는 `dev`인 사용자를 생성하면 자동으로 개발자 권한이 부여됩니다.

#### 방법 2: role 필드 사용 (권장)

1. users 테이블에 `role` 필드 추가 (없는 경우):
   ```sql
   ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT NULL;
   ```

2. 개발자 계정의 role을 설정:
   ```sql
   UPDATE users SET role = 'developer' WHERE username = 'your_username';
   ```

## 관리자 페이지 접근

1. 개발자 계정으로 로그인
2. 네비게이션 바에서 "⚙️ Admin" 링크 클릭
3. 또는 직접 `/admin/prompts` 접속

## AI 프롬프트 설정

### System Prompt (채팅 보조 AI 설정)

각 도구의 **System Prompt**는 사용자와 채팅할 때 AI가 어떻게 보조할지를 결정합니다.

**설정 가능한 항목:**
- AI의 역할과 목적
- 질문하는 방식과 내용
- 대화 톤 (친근한/전문적인/기술적인 등)
- 추천하는 내용
- 최종 프롬프트 형식

**예시:**
```
You are a technical simulation expert. Focus on:
- Mathematical precision
- Performance optimization
- Code efficiency
Ask technical questions about algorithms, data structures, and computational complexity.
Be concise and technical in your responses.
```

### Generation Prompt (코드/결과 생성 프롬프트)

각 도구의 **Generation Prompt**는 실제 코드나 결과를 생성할 때 사용됩니다.

**설정 가능한 항목:**
- 생성물의 형식
- 요구사항
- 출력 구조

## 프롬프트 저장

1. 각 도구의 프롬프트를 수정
2. "💾 Save [도구명] Settings" 버튼 클릭
3. 저장 성공 메시지 확인
4. 변경사항은 즉시 적용됨 (서버 재시작 불필요)

## 주의사항

- 프롬프트 변경은 즉시 적용됩니다
- 잘못된 프롬프트는 AI 동작에 영향을 줄 수 있습니다
- 변경 전에 백업을 권장합니다 (`config/prompts.json` 파일)

## 문제 해결

### 개발자 권한이 인식되지 않는 경우

1. 로그아웃 후 다시 로그인
2. Username이 `admin`, `developer`, `dev` 중 하나인지 확인
3. users 테이블에 `role` 필드가 있다면 값 확인

### 프롬프트가 저장되지 않는 경우

1. 브라우저 콘솔에서 오류 확인
2. `config/prompts.json` 파일 권한 확인
3. 서버 로그 확인

