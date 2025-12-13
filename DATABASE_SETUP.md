# 데이터베이스 설정 가이드

## 문제: "Access denied for user 'app_36574'@'localhost'"

이 오류는 MySQL 데이터베이스와 사용자가 아직 생성되지 않았을 때 발생합니다.

## 해결 방법

### 방법 1: 자동 설정 스크립트 사용 (권장)

1. **MySQL root 계정 비밀번호 확인**
   - MySQL root 계정의 비밀번호를 알고 있어야 합니다.
   - 비밀번호가 없다면 빈 문자열을 사용할 수 있습니다.

2. **데이터베이스 초기화 스크립트 실행**

   ```bash
   # 방법 A: npm 스크립트 사용 (비밀번호 없을 때)
   npm run setup-db
   
   # 방법 B: 직접 실행 (비밀번호 없을 때)
   node scripts/setup-database.js
   
   # 방법 C: root 비밀번호 제공
   node scripts/setup-database.js your_root_password
   ```

3. **환경 변수로 root 비밀번호 설정 (선택)**

   ```bash
   # Windows PowerShell
   $env:MYSQL_ROOT_PASSWORD="your_root_password"
   npm run setup-db
   
   # Windows CMD
   set MYSQL_ROOT_PASSWORD=your_root_password
   npm run setup-db
   
   # Linux/Mac
   export MYSQL_ROOT_PASSWORD=your_root_password
   npm run setup-db
   ```

### 방법 2: MySQL에 직접 접속하여 수동 설정

1. **MySQL에 root로 접속**

   ```bash
   mysql -u root -p
   ```

2. **다음 SQL 명령어 실행**

   ```sql
   -- 데이터베이스 생성
   CREATE DATABASE IF NOT EXISTS `app_36574` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   -- 사용자 생성
   CREATE USER IF NOT EXISTS 'app_36574'@'localhost' IDENTIFIED BY '0b02719d-19ed-44a6-b171-2fb47402429f';
   
   -- 권한 부여
   GRANT ALL PRIVILEGES ON `app_36574`.* TO 'app_36574'@'localhost';
   FLUSH PRIVILEGES;
   
   -- 데이터베이스 선택
   USE app_36574;
   
   -- users 테이블 생성
   CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     username VARCHAR(255) NOT NULL UNIQUE,
     password VARCHAR(255) NOT NULL,
     role VARCHAR(50) DEFAULT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```

3. **MySQL 종료**

   ```sql
   EXIT;
   ```

## 확인

설정이 완료되면 다음을 확인하세요:

1. **서버 실행**

   ```bash
   npm start
   ```

2. **개발자 계정 생성 페이지 접속**

   브라우저에서 `http://localhost:8000/admin/create-dev` 접속

3. **계정 생성**

   - Username: `admin` (또는 원하는 사용자명)
   - Password: 원하는 비밀번호 입력
   - "Create Developer Account" 버튼 클릭

## 문제 해결

### MySQL 서버가 실행되지 않는 경우

**Windows:**
```powershell
# 서비스 확인
Get-Service MySQL*

# 서비스 시작
Start-Service MySQL80
# 또는
net start MySQL80
```

**Linux/Mac:**
```bash
# 서비스 상태 확인
sudo systemctl status mysql
# 또는
sudo service mysql status

# 서비스 시작
sudo systemctl start mysql
# 또는
sudo service mysql start
```

### root 비밀번호를 모르는 경우

1. **MySQL 설정 파일 확인**
   - Windows: `C:\ProgramData\MySQL\MySQL Server X.X\my.ini`
   - Linux: `/etc/mysql/my.cnf` 또는 `/etc/my.cnf`
   - Mac: `/usr/local/mysql/my.cnf`

2. **비밀번호 재설정**
   - MySQL 공식 문서 참고: https://dev.mysql.com/doc/refman/8.0/en/resetting-permissions.html

3. **또는 새로운 MySQL 사용자 생성**
   - root 대신 다른 관리자 계정 사용 가능

### 다른 데이터베이스 정보를 사용하고 싶은 경우

`db/config.js` 파일을 수정하세요:

```javascript
const DB_HOST = '127.0.0.1';
const DB_NAME = 'your_database_name';
const DB_USER = 'your_username';
const DB_PASS = 'your_password';
```

## 추가 정보

- 데이터베이스 설정 파일: `db/config.js`
- 개발자 계정 생성 스크립트: `scripts/create-dev-account.js`
- 데이터베이스 초기화 스크립트: `scripts/setup-database.js`











