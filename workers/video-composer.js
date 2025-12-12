// Video Composer - Combines scripts, simulations, and other elements into final video
const LocalAIApi = require('../ai/LocalAIApi');
const PromptManager = require('../ai/PromptManager');
const AIVideoGenerator = require('./ai-video-generator');
const TTSGenerator = require('./tts-generator');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class VideoComposer {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'outputs', 'videos');
    this.tempDir = path.join(__dirname, '..', 'outputs', 'temp');
    this.ensureOutputDirs();
  }

  ensureOutputDirs() {
    [this.outputDir, this.tempDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async generateVideoPlan(conversationHistory, resources = {}) {
    try {
      const generationPrompt = PromptManager.getGenerationPrompt('video');
      
      const resourcesInfo = [];
      if (resources.script) resourcesInfo.push(`Script: ${resources.script}`);
      if (resources.simulationVideo) resourcesInfo.push(`Simulation Video: ${resources.simulationVideo}`);
      
      const messages = [
        { role: 'system', content: generationPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: `Available resources:\n${resourcesInfo.join('\n')}\n\nCreate a detailed video production plan.`
        }
      ];

      const resp = await LocalAIApi.createResponse({
        input: messages,
        model: require('../ai/config').default_model,
      });

      if (resp && resp.success) {
        const planText = LocalAIApi.extractText(resp);
        return {
          success: true,
          plan: planText,
        };
      }

      return {
        success: false,
        error: resp?.error || 'Failed to generate video plan',
      };
    } catch (error) {
      console.error('Video plan generation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async composeVideo(scriptPath, simulationVideoPath, options = {}) {
    // 구조화된 대본(JSON)인지 확인
    const isStructuredScript = scriptPath.endsWith('.json') && fs.existsSync(scriptPath);
    
    if (isStructuredScript) {
      try {
        const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
        if (scriptData.segments && Array.isArray(scriptData.segments)) {
          console.log('[VideoComposer] 구조화된 대본 감지, TTS Generator 사용');
          return await this.composeVideoWithStructuredScript(scriptData, simulationVideoPath, options);
        }
      } catch (error) {
        console.warn('[VideoComposer] JSON 파싱 실패, 기본 방식 사용:', error.message);
      }
    }
    
    // MoviePy 기반 Python 스크립트 사용 시도
    const pythonScriptPath = path.join(__dirname, 'video_composer.py');
    
    if (fs.existsSync(pythonScriptPath)) {
      return this.composeVideoWithMoviePy(scriptPath, simulationVideoPath, options);
    } else {
      // Fallback to FFmpeg (기존 방식)
      return this.composeVideoWithFFmpeg(scriptPath, simulationVideoPath, options);
    }
  }
  
  /**
   * 구조화된 대본을 사용한 비디오 합성
   */
  async composeVideoWithStructuredScript(scriptData, simulationVideoPath, options = {}) {
    console.log('[VideoComposer] 구조화된 대본으로 비디오 생성 시작...');
    
    try {
      // 1. TTS로 각 세그먼트 오디오 생성
      console.log('[VideoComposer] TTS 오디오 생성 중...');
      const audioFiles = await TTSGenerator.generateFromStructuredScript(scriptData);
      
      if (audioFiles.length === 0) {
        throw new Error('No audio files generated');
      }
      
      // 2. Python 스크립트로 비디오 합성 (구조화된 대본 지원)
      const pythonScriptPath = path.join(__dirname, 'video_composer_structured.py');
      
      // 구조화된 대본용 Python 스크립트가 없으면 기본 스크립트 사용
      const useStructuredScript = fs.existsSync(pythonScriptPath);
      
      if (useStructuredScript) {
        return await this.composeVideoWithStructuredPython(scriptData, audioFiles, simulationVideoPath, options);
      } else {
        // 기본 Python 스크립트 사용 (임시 JSON 파일 생성)
        const tempJsonPath = path.join(this.tempDir, `script_${Date.now()}.json`);
        fs.writeFileSync(tempJsonPath, JSON.stringify(scriptData, null, 2));
        
        // 오디오 파일들을 하나로 합치기
        const combinedAudioPath = await this.combineAudioFiles(audioFiles);
        
        return await this.composeVideoWithMoviePy(tempJsonPath, simulationVideoPath, {
          ...options,
          audioFile: combinedAudioPath,
          structuredScript: true
        });
      }
    } catch (error) {
      console.error('[VideoComposer] 구조화된 대본 비디오 생성 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * 오디오 파일들을 하나로 합치기
   */
  async combineAudioFiles(audioFiles) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      
      // 파일 목록 생성
      const fileListPath = path.join(this.tempDir, `audio_list_${Date.now()}.txt`);
      const fileListContent = audioFiles.map(af => `file '${af.audioFile.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(fileListPath, fileListContent);
      
      const outputPath = path.join(this.tempDir, `combined_audio_${Date.now()}.mp3`);
      
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', fileListPath,
        '-c', 'copy',
        outputPath
      ];
      
      const ffmpegProcess = spawn(ffmpegPath, args);
      
      let stderr = '';
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpegProcess.on('close', (code) => {
        try {
          fs.unlinkSync(fileListPath);
        } catch (e) {}
        
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg failed: ${stderr}`));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
  
  /**
   * 구조화된 대본용 Python 스크립트 사용
   */
  async composeVideoWithStructuredPython(scriptData, audioFiles, simulationVideoPath, options) {
    return new Promise((resolve) => {
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      const pythonScriptPath = path.join(__dirname, 'video_composer_structured.py');
      
      // 임시 파일 생성
      const scriptJsonPath = path.join(this.tempDir, `script_${Date.now()}.json`);
      const audioListPath = path.join(this.tempDir, `audio_list_${Date.now()}.json`);
      
      fs.writeFileSync(scriptJsonPath, JSON.stringify(scriptData, null, 2));
      fs.writeFileSync(audioListPath, JSON.stringify(audioFiles, null, 2));
      
      const pythonArgs = [
        pythonScriptPath,
        scriptJsonPath,
        audioListPath,
        simulationVideoPath,
        this.outputDir,
        this.tempDir,
        JSON.stringify(options || {})
      ];
      
      console.log('[VideoComposer] 구조화된 Python 스크립트로 비디오 생성 시작...');
      
      const pythonProcess = spawn(pythonPath, pythonArgs, {
        cwd: path.dirname(pythonScriptPath),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log('[VideoComposer] 비디오 생성 완료:', result.url);
              resolve(result);
            } else {
              resolve(result);
            }
          } catch (e) {
            console.error('[VideoComposer] JSON 파싱 오류:', e);
            resolve({
              success: false,
              error: 'Failed to parse Python script result',
              stdout: stdout.substring(0, 1000)
            });
          }
        } else {
          console.error('[VideoComposer] Python 프로세스 종료 코드:', code);
          resolve({
            success: false,
            error: `Python script execution failed (exit code: ${code})`,
            stderr: stderr.substring(0, 1000)
          });
        }
      });
      
      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Python execution error: ${error.message}`
        });
      });
      
      // 타임아웃: 30분
      setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        resolve({
          success: false,
          error: 'Video composition timeout (30 minutes)'
        });
      }, 30 * 60 * 1000);
    });
  }

  async composeVideoWithMoviePy(scriptPath, simulationVideoPath, options = {}) {
    return new Promise((resolve) => {
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      const pythonScriptPath = path.join(__dirname, 'video_composer.py');
      
      // 옵션을 JSON으로 변환
      const optionsJson = JSON.stringify({
        lang: options.lang || 'ko',
        subtitle_position: options.subtitle_position || 'bottom',
        fontsize: options.fontsize || 40,
        subtitle_color: options.subtitle_color || 'white',
      });

      const pythonArgs = [
        pythonScriptPath,
        scriptPath,
        simulationVideoPath,
        this.outputDir,
        this.tempDir,
        optionsJson,
      ];

      console.log('[VideoComposer] MoviePy로 비디오 생성 시작...');
      console.log('[VideoComposer] Python 명령:', pythonPath, pythonArgs.join(' '));

      const pythonProcess = spawn(pythonPath, pythonArgs, {
        cwd: path.dirname(pythonScriptPath),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
        stdio: ['pipe', 'pipe', 'pipe'], // Windows에서 출력 캡처를 위해 명시적으로 설정
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        // 진행 상황 출력 (있는 경우)
        if (text.includes('t:') || text.includes('chunk')) {
          process.stdout.write(text);
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        // 경고는 무시하고 에러만 표시
        if (!text.includes('WARNING') && !text.includes('DeprecationWarning')) {
          console.error('[VideoComposer Python]', text);
        }
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // JSON 결과 파싱
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log('[VideoComposer] 비디오 생성 완료:', result.url);
              resolve(result);
            } else {
              console.error('[VideoComposer] Python 스크립트 오류:', result.error);
              resolve(result);
            }
          } catch (e) {
            console.error('[VideoComposer] JSON 파싱 오류:', e);
            console.error('[VideoComposer] stdout:', stdout);
            resolve({
              success: false,
              error: 'Python 스크립트 결과를 파싱할 수 없습니다.',
              stdout: stdout.substring(0, 1000),
            });
          }
        } else {
          console.error('[VideoComposer] Python 프로세스 종료 코드:', code);
          console.error('[VideoComposer] stderr:', stderr.substring(0, 1000));
          resolve({
            success: false,
            error: `Python 스크립트 실행 실패 (종료 코드: ${code})`,
            stderr: stderr.substring(0, 1000),
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[VideoComposer] Python 프로세스 오류:', error);
        resolve({
          success: false,
          error: `Python 실행 오류: ${error.message}`,
          suggestion: 'Python 3와 MoviePy가 설치되어 있는지 확인하세요: pip install -r requirements.txt',
        });
      });

      // 타임아웃: 30분
      const timeoutId = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!pythonProcess.killed) {
            pythonProcess.kill('SIGKILL');
          }
        }, 5000);
        resolve({
          success: false,
          error: '비디오 생성 타임아웃 (30분)',
        });
      }, 30 * 60 * 1000);

      pythonProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  async composeVideoWithFFmpeg(scriptPath, simulationVideoPath, options = {}) {
    // 기존 FFmpeg 방식 (fallback)
    return new Promise((resolve) => {
      const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
      const timestamp = Date.now();
      const outputFilename = `video_${timestamp}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);

      // Check if files exist
      if (!fs.existsSync(scriptPath)) {
        return resolve({
          success: false,
          error: 'Script file not found',
        });
      }

      if (!fs.existsSync(simulationVideoPath)) {
        return resolve({
          success: false,
          error: 'Simulation video file not found',
        });
      }

      // Read script for narration (for now, we'll just combine videos)
      const script = fs.readFileSync(scriptPath, 'utf8');

      // Simple video composition: combine simulation video with text overlay
      const ffmpegArgs = [
        '-i', simulationVideoPath,
        '-vf', `drawtext=text='${script.substring(0, 50).replace(/'/g, "\\'")}...':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-th-40`,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'copy',
        '-y', // Overwrite output file
        outputPath,
      ];

      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

      let stderr = '';

      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({
            success: true,
            outputFile: outputFilename,
            outputPath: outputPath,
            url: `/outputs/videos/${outputFilename}`,
          });
        } else {
          resolve({
            success: false,
            error: `FFmpeg process exited with code ${code}`,
            stderr: stderr,
          });
        }
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        ffmpegProcess.kill();
        resolve({
          success: false,
          error: 'Video composition timeout',
        });
      }, 10 * 60 * 1000);
    });
  }

  async createVideoFromResources(scriptPath, simulationVideoPath, conversationHistory, options = {}) {
    // Step 1: Generate plan
    const planResult = await this.generateVideoPlan(conversationHistory, {
      script: scriptPath,
      simulationVideo: simulationVideoPath,
    });

    if (!planResult.success) {
      return planResult;
    }

    // Step 2: Optionally generate AI video segments
    let aiVideoPath = null;
    if (options.generateAIVideo !== false) {
      try {
        console.log('[VideoComposer] AI 비디오 생성 시도 중...');
        const aiVideoResult = await AIVideoGenerator.generateVideoFromScript(
          scriptPath, 
          conversationHistory,
          {
            model: options.aiModel || 'cerspense/zeroscope_v2_576w',
            frames: options.aiFrames || 24,
            steps: options.aiSteps || 50,
          }
        );
        
        if (aiVideoResult.success) {
          aiVideoPath = aiVideoResult.output_path;
          console.log('[VideoComposer] AI 비디오 생성 완료:', aiVideoPath);
        } else {
          console.log('[VideoComposer] AI 비디오 생성 실패 (계속 진행):', aiVideoResult.error);
        }
      } catch (error) {
        console.log('[VideoComposer] AI 비디오 생성 오류 (계속 진행):', error.message);
      }
    }

    // Step 3: Compose video (with AI video if available)
    const composeResult = await this.composeVideo(
      scriptPath, 
      simulationVideoPath,
      {
        ...options,
        aiVideoPath: aiVideoPath,
      }
    );

    return {
      ...composeResult,
      plan: planResult.plan,
      aiVideo: aiVideoPath ? {
        path: aiVideoPath,
        url: composeResult.url ? path.dirname(composeResult.url) + '/ai-videos/' + path.basename(aiVideoPath) : null,
      } : null,
    };
  }
}

module.exports = new VideoComposer();

