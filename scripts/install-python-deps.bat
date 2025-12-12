@echo off
echo Python 의존성 설치 중...
pip install -r requirements.txt
if %errorlevel% equ 0 (
    echo 설치 완료!
) else (
    echo 설치 실패. Python과 pip가 설치되어 있는지 확인하세요.
    pause
)









