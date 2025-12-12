// TTS Generator - Generates audio from structured script with SSML support
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class TTSGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'outputs', 'audio');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * 구조화된 대본에서 오디오 생성
   */
  async generateFromStructuredScript(scriptData) {
    const audioFiles = [];
    const errors = [];
    
    console.log('[TTSGenerator] 구조화된 대본에서 오디오 생성 시작...');
    console.log('[TTSGenerator] 세그먼트 수:', scriptData.segments?.length || 0);
    
    // 세그먼트 배열 검증
    if (!scriptData.segments || !Array.isArray(scriptData.segments) || scriptData.segments.length === 0) {
      throw new Error('세그먼트가 없거나 유효하지 않습니다. segments 배열이 비어있습니다.');
    }
    
    for (let i = 0; i < scriptData.segments.length; i++) {
      const segment = scriptData.segments[i];
      
      // 세그먼트 검증
      if (!segment || !segment.text || typeof segment.text !== 'string' || segment.text.trim().length === 0) {
        const errorMsg = `세그먼트 ${i + 1} (ID: ${segment?.id || 'unknown'})에 유효한 텍스트가 없습니다.`;
        console.warn(`[TTSGenerator] ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }
      
      const textPreview = segment.text.length > 30 ? segment.text.substring(0, 30) + '...' : segment.text;
      console.log(`[TTSGenerator] 세그먼트 ${i + 1}/${scriptData.segments.length} 생성 중: "${textPreview}"`);
      
      try {
        const audioFile = await this.generateSegmentAudio(segment, scriptData.metadata?.language || 'ko');
        
        if (!audioFile || !fs.existsSync(audioFile)) {
          throw new Error(`오디오 파일이 생성되지 않았습니다: ${audioFile}`);
        }
        
        audioFiles.push({
          segmentId: segment.id,
          audioFile: audioFile,
          startTime: segment.startTime,
          endTime: segment.endTime,
          duration: segment.endTime - segment.startTime
        });
        
        console.log(`[TTSGenerator] 세그먼트 ${i + 1} 생성 성공: ${audioFile}`);
      } catch (error) {
        const errorMsg = `세그먼트 ${i + 1} (ID: ${segment.id || 'unknown'}) 생성 실패: ${error.message}`;
        console.error(`[TTSGenerator] ${errorMsg}`);
        console.error(`[TTSGenerator] 스택 트레이스:`, error.stack);
        errors.push(errorMsg);
        // 실패해도 계속 진행
      }
    }
    
    console.log('[TTSGenerator] 오디오 생성 완료:', audioFiles.length, '개 파일 생성됨,', errors.length, '개 실패');
    
    // 모든 세그먼트가 실패한 경우
    if (audioFiles.length === 0 && errors.length > 0) {
      const errorSummary = errors.slice(0, 3).join('; '); // 처음 3개 에러만 표시
      throw new Error(`모든 오디오 생성 실패. 원인: ${errorSummary}${errors.length > 3 ? ` (총 ${errors.length}개 실패)` : ''}`);
    }
    
    // 일부만 실패한 경우 경고 로그
    if (errors.length > 0) {
      console.warn(`[TTSGenerator] 경고: ${errors.length}개 세그먼트 생성 실패, ${audioFiles.length}개 성공`);
    }
    
    return audioFiles;
  }

  /**
   * 단일 세그먼트 오디오 생성
   */
  async generateSegmentAudio(segment, language = 'ko') {
    const { text, tts } = segment;
    
    // 텍스트 검증
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('세그먼트에 유효한 텍스트가 없습니다.');
    }
    
    // SSML 생성
    const ssml = this.buildSSML(text, tts, language);
    
    // Google TTS 사용 (SSML 지원)
    // Google Cloud TTS API 키가 있으면 사용, 없으면 gTTS fallback
    const useGoogleCloud = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    
    if (useGoogleCloud) {
      console.log(`[TTSGenerator] Google Cloud TTS 사용 (세그먼트 ID: ${segment.id})`);
      try {
        return await this.generateWithGoogleCloudTTS(ssml, segment.id, language);
      } catch (error) {
        console.error(`[TTSGenerator] Google Cloud TTS 실패, gTTS로 fallback:`, error.message);
        // Google Cloud 실패 시 gTTS로 fallback
        return await this.generateWithGTTS(text, segment.id, language, tts);
      }
    } else {
      // gTTS fallback (SSML 없이, 하지만 파라미터는 로그에 기록)
      console.log(`[TTSGenerator] Google Cloud TTS API 키 없음, gTTS 사용 (세그먼트 ID: ${segment.id}, SSML 파라미터는 적용되지 않음)`);
      return await this.generateWithGTTS(text, segment.id, language, tts);
    }
  }

  /**
   * SSML 생성
   */
  buildSSML(text, ttsParams, language = 'ko') {
    const { speed, pitch, volume, tone, emotion } = ttsParams || {};
    
    // SSML 속성 설정
    let prosodyAttrs = [];
    
    if (speed) {
      const speedMap = {
        'slow': '0.8',
        'normal': '1.0',
        'fast': '1.2'
      };
      prosodyAttrs.push(`rate="${speedMap[speed] || '1.0'}"`);
    }
    
    if (pitch) {
      if (pitch.includes('%')) {
        prosodyAttrs.push(`pitch="${pitch}"`);
      } else {
        const pitchMap = {
          'low': '-10%',
          'normal': '0%',
          'high': '+10%'
        };
        prosodyAttrs.push(`pitch="${pitchMap[pitch] || '0%'}"`);
      }
    }
    
    if (volume) {
      const volumeMap = {
        'quiet': 'soft',
        'normal': 'medium',
        'loud': 'loud'
      };
      prosodyAttrs.push(`volume="${volumeMap[volume] || 'medium'}"`);
    }
    
    // SSML 생성
    let ssml = '<speak>';
    
    if (prosodyAttrs.length > 0) {
      ssml += `<prosody ${prosodyAttrs.join(' ')}>`;
      ssml += this.escapeXml(text);
      ssml += '</prosody>';
    } else {
      ssml += this.escapeXml(text);
    }
    
    ssml += '</speak>';
    
    return ssml;
  }

  /**
   * XML 특수 문자 이스케이프
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Google Cloud TTS API 사용 (SSML 지원)
   */
  async generateWithGoogleCloudTTS(ssml, segmentId, language = 'ko') {
    const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_CLOUD_TTS_API_KEY not set');
    }
    
    // 언어 코드 매핑
    const languageCode = language === 'ko' ? 'ko-KR' : language;
    const voiceName = language === 'ko' ? 'ko-KR-Standard-A' : 'en-US-Standard-B';
    
    const requestBody = {
      input: { ssml: ssml },
      voice: {
        languageCode: languageCode,
        name: voiceName,
        ssmlGender: 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    };
    
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestBody);
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              reject(new Error(response.error.message || 'Google Cloud TTS API error'));
              return;
            }
            
            if (response.audioContent) {
              // Base64 디코딩 및 파일 저장
              const audioBuffer = Buffer.from(response.audioContent, 'base64');
              const filename = `audio_${segmentId}_${Date.now()}.mp3`;
              const filepath = path.join(this.outputDir, filename);
              
              fs.writeFileSync(filepath, audioBuffer);
              
              resolve(filepath);
            } else {
              reject(new Error('No audio content in response'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * gTTS 사용 (fallback, SSML 미지원)
   */
  async generateWithGTTS(text, segmentId, language = 'ko', ttsParams = {}) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      // Windows에서는 python, Linux/Mac에서는 python3 우선 시도
      const possiblePythonPaths = [
        process.env.PYTHON_PATH,
        'python',
        'python3',
        'py' // Windows Python Launcher
      ].filter(p => p);
      
      let pythonPath = possiblePythonPaths[0] || 'python';
      
      // Python 스크립트로 gTTS 사용 (UTF-8 인코딩 명시)
      const script = `# -*- coding: utf-8 -*-
import sys
import os

# Windows에서 출력 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    from gtts import gTTS
except ImportError:
    print("ERROR: gTTS module not found. Please install it with: pip install gtts", file=sys.stderr)
    sys.exit(1)

text = sys.argv[1]
output_path = sys.argv[2]
lang = sys.argv[3]

try:
    slow = (sys.argv[4] == 'slow') if len(sys.argv) > 4 else False
    tts = gTTS(text=text, lang=lang, slow=slow)
    tts.save(output_path)
    
    if os.path.exists(output_path):
        print(output_path)
    else:
        print(f"ERROR: File not created: {output_path}", file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;
      
      const tempScriptPath = path.join(this.outputDir, `tts_temp_${Date.now()}.py`);
      // UTF-8로 파일 저장
      fs.writeFileSync(tempScriptPath, script, 'utf8');
      
      const speed = ttsParams.speed === 'slow' ? 'slow' : 'normal';
      const outputFilePath = path.join(this.outputDir, `audio_${segmentId}_${Date.now()}.mp3`);
      
      // Windows에서는 shell 옵션 사용 시 인자 이스케이프 필요
      // 하지만 shell 옵션 없이 실행하는 것이 더 안전함
      const args = [
        tempScriptPath,
        text,
        outputFilePath,
        language,
        speed
      ];
      
      console.log(`[TTSGenerator] gTTS 실행: ${pythonPath} ${args.map(a => a.length > 50 ? a.substring(0, 50) + '...' : a).join(' ')}`);
      
      // Windows에서도 shell 옵션 없이 실행 (인코딩 문제 방지)
      const pythonProcess = spawn(pythonPath, args, {
        cwd: this.outputDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8', // Python 입출력 인코딩 설정
          PYTHONUNBUFFERED: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe'] // 명시적으로 stdio 설정
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        // UTF-8로 디코딩
        const text = data.toString('utf8');
        stdout += text;
      });
      
      pythonProcess.stderr.on('data', (data) => {
        // UTF-8로 디코딩
        const text = data.toString('utf8');
        stderr += text;
      });
      
      // 타임아웃 설정 (30초)
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (e) {}
        reject(new Error('gTTS 생성 시간 초과 (30초)'));
      }, 30000);
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        // 임시 스크립트 삭제
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (e) {}
        
        if (code === 0 && stdout.trim()) {
          const filepath = stdout.trim();
          if (fs.existsSync(filepath)) {
            console.log(`[TTSGenerator] gTTS 성공: ${filepath}`);
            resolve(filepath);
          } else {
            console.error(`[TTSGenerator] gTTS 실패: 파일이 생성되지 않음 - ${filepath}`);
            reject(new Error(`오디오 파일이 생성되지 않았습니다: ${filepath}. stderr: ${stderr}`));
          }
        } else {
          const errorMsg = stderr || stdout || 'gTTS generation failed';
          console.error(`[TTSGenerator] gTTS 실패 (코드 ${code}):`, errorMsg);
          
          // 더 자세한 에러 메시지 (인코딩 문제로 깨진 메시지도 감지)
          const errorMsgLower = errorMsg.toLowerCase();
          if (errorMsgLower.includes('gtts') && (errorMsgLower.includes('module') || errorMsgLower.includes('import') || errorMsgLower.includes('찾을 수 없습니다') || errorMsgLower.includes('not found'))) {
            reject(new Error('gTTS 라이브러리가 설치되지 않았습니다. PowerShell에서 다음 명령을 실행해주세요:\n\n  pip install gtts\n\n또는 Python이 여러 버전 설치되어 있다면:\n\n  python -m pip install gtts'));
          } else if (errorMsgLower.includes('python') && (errorMsgLower.includes('not found') || errorMsgLower.includes('찾을 수 없습니다') || errorMsgLower.includes('enoent'))) {
            reject(new Error(`Python을 찾을 수 없습니다. PYTHON_PATH 환경 변수를 설정하거나 Python이 설치되어 있는지 확인해주세요. (시도한 경로: ${pythonPath})`));
          } else {
            // 원본 에러 메시지와 함께 안내 메시지 추가
            reject(new Error(`gTTS 생성 실패: ${errorMsg}\n\n해결 방법:\n1. PowerShell에서 "pip install gtts" 실행\n2. Python이 올바르게 설치되어 있는지 확인\n3. 서버를 재시작해보세요`));
          }
        }
      });
      
      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (e) {}
        
        console.error(`[TTSGenerator] Python 프로세스 실행 오류:`, error);
        
        if (error.code === 'ENOENT') {
          reject(new Error(`Python을 찾을 수 없습니다. (시도한 경로: ${pythonPath}). PYTHON_PATH 환경 변수를 설정하거나 Python이 설치되어 있는지 확인해주세요.`));
        } else {
          reject(new Error(`Python 실행 오류: ${error.message}`));
        }
      });
    });
  }
}

module.exports = new TTSGenerator();

