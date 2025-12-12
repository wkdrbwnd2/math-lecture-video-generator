// AI Video Generator - Replicate API 기반 AI 비디오 생성
const LocalAIApi = require('../ai/LocalAIApi');
const PromptManager = require('../ai/PromptManager');
const Replicate = require('replicate');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class AIVideoGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'outputs', 'ai-videos');
    this.progressDir = path.join(__dirname, '..', 'outputs', 'temp', 'progress');
    this.ensureOutputDir();
    this.ensureProgressDir();
    // 진행 상황 저장소 (메모리)
    this.progressStore = new Map();
    
    // Replicate 클라이언트 초기화
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      this.replicate = new Replicate({
        auth: replicateToken,
      });
      console.log('[AIVideoGenerator] Replicate API initialized');
    } else {
      console.warn('[AIVideoGenerator] REPLICATE_API_TOKEN not found. Replicate API will not work.');
      this.replicate = null;
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  ensureProgressDir() {
    if (!fs.existsSync(this.progressDir)) {
      fs.mkdirSync(this.progressDir, { recursive: true });
    }
  }

  // 진행 상황 저장
  saveProgress(jobId, progress) {
    this.progressStore.set(jobId, {
      ...progress,
      timestamp: Date.now(),
    });
    // 파일에도 저장 (선택사항)
    const progressFile = path.join(this.progressDir, `${jobId}.json`);
    try {
      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    } catch (e) {
      // 파일 저장 실패해도 메모리에는 있음
    }
  }

  // 진행 상황 조회
  getProgress(jobId) {
    const progress = this.progressStore.get(jobId);
    if (progress) {
      // 5분 이상 된 진행 상황은 삭제
      if (Date.now() - progress.timestamp > 5 * 60 * 1000) {
        this.progressStore.delete(jobId);
        return null;
      }
      return progress;
    }
    return null;
  }

  /**
   * 대본에서 비디오 생성 프롬프트 추출
   */
  async extractVideoPrompt(scriptText, conversationHistory) {
    try {
      const systemPrompt = `You are a video generation prompt expert. 
Extract or create a concise, visual description (1-2 sentences) from the script that would be suitable for AI video generation.
Focus on visual elements, actions, and scenes that can be represented in video.
Return only the prompt, no explanations.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: `Script:\n${scriptText}\n\nCreate a video generation prompt for this script.`
        }
      ];

      const config = require('../ai/config');
      const resp = await LocalAIApi.createResponse({
        input: messages,
        model: config.default_model,
      });

      if (resp && resp.success) {
        const prompt = LocalAIApi.extractText(resp).trim();
        return {
          success: true,
          prompt: prompt,
        };
      }

      // Fallback: 대본의 첫 부분 사용
      const fallbackPrompt = scriptText.split('\n')[0].substring(0, 200);
      return {
        success: true,
        prompt: fallbackPrompt,
        fallback: true,
      };
    } catch (error) {
      console.error('프롬프트 추출 오류:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 비디오 생성 (Replicate API 또는 로컬 Hugging Face 모델)
   */
  async generateVideo(prompt, options = {}) {
    // 기본값: Hugging Face 로컬 모델 사용 (원래 의도)
    // Replicate API를 사용하려면 USE_REPLICATE_API=true 설정
    const useReplicate = options.useReplicate || process.env.USE_REPLICATE_API === 'true' || process.env.USE_REPLICATE_API === '1';
    
    // Replicate API를 명시적으로 요청하지 않으면 로컬 Hugging Face 모델 사용
    if (!useReplicate) {
      console.log('[AIVideoGenerator] 로컬 Hugging Face 모델 사용 (diffusers) - 기본값');
      return this.generateVideoLocal(prompt, options);
    }
    
    // Replicate API 사용 (명시적으로 요청한 경우만)
    if (!this.replicate) {
      console.log('[AIVideoGenerator] Replicate API 토큰이 없어서 로컬 모드로 전환');
      return this.generateVideoLocal(prompt, options);
    }
    
    console.log('[AIVideoGenerator] Replicate API 사용');

    // 작업 ID 생성
    const jobId = `ai-video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 초기 진행 상황 저장
    this.saveProgress(jobId, {
      status: 'starting',
      message: 'Initializing video generation with Replicate API...',
      progress: 5,
    });

    try {
      // 진행 상황 업데이트: 모델 시작
      this.saveProgress(jobId, {
        status: 'generating',
        message: 'Starting video generation...',
        progress: 10,
      });

      // Replicate의 Zeroscope 모델 사용
      // 모델: anotherjesse/zeroscope-v2-xl 또는 다른 text-to-video 모델
      const model = options.model || 'anotherjesse/zeroscope-v2-xl:71996d331e8ede8ef7bd76eba9fae076d31792e4fdf4ad057779b443d6aea62f';
      
      console.log('[AIVideoGenerator] Replicate API로 비디오 생성 시작...');
      console.log('[AIVideoGenerator] 프롬프트:', prompt.substring(0, 100) + '...');
      console.log('[AIVideoGenerator] 모델:', model);

      // 진행 상황 업데이트: 생성 중
      this.saveProgress(jobId, {
        status: 'generating',
        message: 'Generating video with AI model (this may take 1-3 minutes)...',
        progress: 30,
      });

      // Replicate API 호출
      const output = await this.replicate.run(model, {
        input: {
          prompt: prompt,
          num_frames: options.frames || 24,
          width: options.width || 576,
          height: options.height || 320,
          num_inference_steps: options.steps || 50,
          guidance_scale: options.guidanceScale || 7.5,
          negative_prompt: options.negativePrompt || 'blurry, low quality, distorted, artifacts',
        }
      });

      // 진행 상황 업데이트: 비디오 다운로드 중
      this.saveProgress(jobId, {
        status: 'saving',
        message: 'Downloading generated video...',
        progress: 80,
      });

      // output은 비디오 URL 배열 또는 단일 URL
      let videoUrl = null;
      if (Array.isArray(output) && output.length > 0) {
        videoUrl = output[0];
      } else if (typeof output === 'string') {
        videoUrl = output;
      } else if (output && output.video) {
        videoUrl = output.video;
      }

      if (!videoUrl) {
        throw new Error('No video URL returned from Replicate API');
      }

      console.log('[AIVideoGenerator] 비디오 URL 받음:', videoUrl);

      // 비디오 다운로드
      const outputFilename = `video_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      await this.downloadVideo(videoUrl, outputPath);

      // 진행 상황 업데이트: 완료
      const result = {
        success: true,
        output_path: outputPath,
        url: `/outputs/ai-videos/${outputFilename}`,
        jobId: jobId,
        prompt: prompt,
      };

      this.saveProgress(jobId, {
        status: 'completed',
        message: 'Video generation completed!',
        progress: 100,
        result: result,
      });

      console.log('[AIVideoGenerator] 비디오 생성 완료:', outputPath);
      return result;

    } catch (error) {
      console.error('[AIVideoGenerator] Replicate API 오류:', error);
      
      this.saveProgress(jobId, {
        status: 'failed',
        message: error.message || 'Video generation failed',
        progress: 0,
        error: error.message,
      });

      return {
        success: false,
        error: error.message || 'Failed to generate video',
        jobId: jobId,
      };
    }
  }

  /**
   * 비디오 URL에서 파일 다운로드
   */
  async downloadVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        // 리다이렉트 처리
        if (response.statusCode === 301 || response.statusCode === 302) {
          return this.downloadVideo(response.headers.location, outputPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download video: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {}); // 파일 삭제
        reject(err);
      });
    });
  }

  /**
   * 로컬 Python 스크립트를 사용한 비디오 생성 (Hugging Face diffusers 사용)
   */
  async generateVideoLocal(prompt, options = {}) {
    const pythonScriptPath = path.join(__dirname, 'ai_video_generator.py');
    
    if (!fs.existsSync(pythonScriptPath)) {
      return {
        success: false,
        error: 'AI video generation script not found.',
      };
    }

    // 작업 ID 생성
    const jobId = `ai-video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 초기 진행 상황 저장
    this.saveProgress(jobId, {
      status: 'starting',
      message: 'Initializing video generation...',
      progress: 0,
    });

    return new Promise((resolve) => {
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      
      const args = [
        pythonScriptPath,
        prompt,
        this.outputDir,
        '--model', options.model || 'cerspense/zeroscope_v2_576w',
        '--negative-prompt', options.negativePrompt || '',
        '--steps', String(options.steps || 50),
        '--height', String(options.height || 320),
        '--width', String(options.width || 576),
        '--frames', String(options.frames || 24),
        '--guidance', String(options.guidanceScale || 7.5),
      ];

      if (options.device) {
        args.push('--device', options.device);
      }

      console.log('[AIVideoGenerator] AI 비디오 생성 시작...');
      console.log('[AIVideoGenerator] 프롬프트:', prompt.substring(0, 100) + '...');

      // 환경 변수 준비 (Hugging Face 토큰 포함)
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      };
      
      // Hugging Face 토큰이 .env에 있으면 전달
      // dotenv를 통해 이미 로드되었을 수 있음
      if (process.env.HF_TOKEN) {
        env.HF_TOKEN = process.env.HF_TOKEN;
      }
      if (process.env.HUGGINGFACE_TOKEN) {
        env.HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
      }
      
      const pythonProcess = spawn(pythonPath, args, {
        cwd: path.dirname(pythonScriptPath),
        env: env,
        stdio: ['pipe', 'pipe', 'pipe'], // Windows에서 출력 캡처를 위해 명시적으로 설정
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        
        // JSON Lines 형식의 진행 상황 파싱 시도
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{') && line.includes('"progress"')) {
            try {
              const progress = JSON.parse(line.trim());
              if (progress.status || progress.progress !== undefined) {
                this.saveProgress(jobId, progress);
              }
            } catch (e) {
              // JSON 파싱 실패는 무시
            }
          }
        }
      });

      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        
        // 진행 상황 메시지 파싱
        if (text.includes('[AIVideoGenerator]')) {
          process.stdout.write(text);
          
          // 진행 상황 업데이트
          let status = 'processing';
          let message = 'Processing...';
          let progress = 0;
          
          if (text.includes('Loading model')) {
            status = 'loading_model';
            message = 'Loading AI model...';
            progress = 10;
          } else if (text.includes('Model loaded')) {
            status = 'model_loaded';
            message = 'Model loaded, starting generation...';
            progress = 30;
          } else if (text.includes('Starting video generation')) {
            status = 'generating';
            message = 'Generating video frames...';
            progress = 40;
          } else if (text.includes('Video generation completed')) {
            status = 'saving';
            message = 'Saving video...';
            progress = 90;
          }
          
          this.saveProgress(jobId, {
            status,
            message,
            progress,
          });
        }
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log('[AIVideoGenerator] Video generation completed:', result.url);
              this.saveProgress(jobId, {
                status: 'completed',
                message: 'Video generation completed!',
                progress: 100,
                result: result,
              });
              resolve({
                ...result,
                jobId: jobId,
              });
            } else {
              console.error('[AIVideoGenerator] Generation failed:', result.error);
              this.saveProgress(jobId, {
                status: 'failed',
                message: result.error || 'Generation failed',
                progress: 0,
                error: result.error,
              });
              resolve({
                ...result,
                jobId: jobId,
              });
            }
          } catch (e) {
            console.error('[AIVideoGenerator] JSON parsing error:', e);
            console.error('[AIVideoGenerator] stdout:', stdout.substring(0, 1000));
            this.saveProgress(jobId, {
              status: 'failed',
              message: 'Failed to parse Python script result',
              progress: 0,
              error: 'Failed to parse result',
            });
            resolve({
              success: false,
              error: 'Failed to parse Python script result',
              stdout: stdout.substring(0, 1000),
              jobId: jobId,
            });
          }
        } else {
          console.error('[AIVideoGenerator] Python process exit code:', code);
          console.error('[AIVideoGenerator] stderr:', stderr.substring(0, 2000));
          this.saveProgress(jobId, {
            status: 'failed',
            message: 'Python script execution failed',
            progress: 0,
            error: `Exit code: ${code}`,
          });
          resolve({
            success: false,
            error: `Python script execution failed (exit code: ${code})`,
            stderr: stderr.substring(0, 2000),
            suggestion: 'If no GPU, CPU mode will work but may be slow. Check if diffusers and torch are installed.',
            jobId: jobId,
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[AIVideoGenerator] Python 프로세스 오류:', error);
        resolve({
          success: false,
          error: `Python 실행 오류: ${error.message}`,
          suggestion: 'Python 3와 필요한 패키지가 설치되어 있는지 확인하세요: pip install -r requirements.txt',
        });
      });

      // 타임아웃: 30분 (AI 비디오 생성은 시간이 오래 걸릴 수 있음)
      const timeoutId = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!pythonProcess.killed) {
            pythonProcess.kill('SIGKILL');
          }
        }, 5000);
        resolve({
          success: false,
          error: 'AI 비디오 생성 타임아웃 (30분)',
        });
      }, 30 * 60 * 1000);

      pythonProcess.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * 대본과 대화 기록에서 AI 비디오 생성
   */
  async generateVideoFromScript(scriptPath, conversationHistory, options = {}) {
    try {
      // 1. 대본 읽기
      if (!fs.existsSync(scriptPath)) {
        return {
          success: false,
          error: '대본 파일을 찾을 수 없습니다.',
        };
      }

      const scriptText = fs.readFileSync(scriptPath, 'utf8');

      // 2. 비디오 생성 프롬프트 추출
      const promptResult = await this.extractVideoPrompt(scriptText, conversationHistory);
      if (!promptResult.success) {
        return promptResult;
      }

      // 3. AI 비디오 생성
      const videoResult = await this.generateVideo(promptResult.prompt, options);

      return {
        ...videoResult,
        prompt: promptResult.prompt,
        promptFallback: promptResult.fallback || false,
      };
    } catch (error) {
      console.error('AI 비디오 생성 오류:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new AIVideoGenerator();

