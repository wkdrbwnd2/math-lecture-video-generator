// Script Generator - Generates actual scripts from finalized prompts
const LocalAIApi = require('../ai/LocalAIApi');
const PromptManager = require('../ai/PromptManager');
const fs = require('fs');
const path = require('path');

class ScriptGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'outputs', 'scripts');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateScript(conversationHistory, options = {}) {
    try {
      // Build the prompt for script generation with structured format
      const generationPrompt = `You are a script generator for educational videos. 
Generate a structured script in JSON format that includes timing and TTS parameters for each segment.

The script must be in this exact JSON format:
{
  "metadata": {
    "title": "video title",
    "totalDuration": estimated_total_duration_in_seconds,
    "language": "ko"
  },
  "segments": [
    {
      "id": "segment-1",
      "startTime": 0,
      "endTime": 5,
      "text": "dialogue text",
      "tts": {
        "pronunciation": "how to pronounce (same as text if no special pronunciation needed)",
        "speed": "slow|normal|fast",
        "pitch": "low|normal|high|+10%|-10%",
        "volume": "quiet|normal|loud",
        "tone": "친근함|교육적|진지함|밝음|차분함|열정적",
        "emotion": "welcoming|enthusiastic|calm|excited|serious|friendly"
      }
    }
  ]
}

Important rules:
- Each segment should have realistic timing (estimate speaking time: Korean ~3-4 characters per second)
- Adjust TTS parameters based on context:
  * Opening: friendly, welcoming, normal speed
  * Explanations: educational, calm, slow speed
  * Important points: serious, normal speed, normal pitch
  * Transitions: friendly, normal speed
- Use appropriate Korean tones and emotions
- Return ONLY valid JSON, no explanations or markdown code blocks
- Ensure all segments have sequential timing (endTime of one = startTime of next)`;

      // Combine conversation history with generation prompt
      const messages = [
        { role: 'system', content: generationPrompt },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: 'Generate a complete structured script in JSON format based on our conversation. Include timing and TTS parameters (speed, pitch, tone, emotion) for each segment. Return only valid JSON.'
        }
      ];

      const resp = await LocalAIApi.createResponse({
        input: messages,
        model: options.model || require('../ai/config').default_model,
      });

      if (resp && resp.success) {
        let scriptText = LocalAIApi.extractText(resp);
        
        // JSON 추출 (코드 블록 제거)
        const jsonMatch = scriptText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scriptText = jsonMatch[0];
        }
        
        // JSON 파싱 및 검증
        let scriptData;
        try {
          scriptData = JSON.parse(scriptText);
          
          // 기본 검증 및 수정
          if (!scriptData.segments || !Array.isArray(scriptData.segments)) {
            throw new Error('Invalid script format: segments missing');
          }
          
          // 각 세그먼트 검증 및 기본값 설정
          scriptData.segments = scriptData.segments.map((seg, index) => {
            if (!seg.tts) seg.tts = {};
            return {
              id: seg.id || `segment-${index + 1}`,
              startTime: seg.startTime || 0,
              endTime: seg.endTime || (seg.startTime || 0) + 5,
              text: seg.text || '',
              tts: {
                pronunciation: seg.tts.pronunciation || seg.text || '',
                speed: seg.tts.speed || 'normal',
                pitch: seg.tts.pitch || 'normal',
                volume: seg.tts.volume || 'normal',
                tone: seg.tts.tone || 'normal',
                emotion: seg.tts.emotion || 'neutral'
              }
            };
          });
          
          // 시간 순서 정렬 및 연속성 보장
          let currentTime = 0;
          scriptData.segments = scriptData.segments.map(seg => {
            seg.startTime = currentTime;
            const duration = seg.endTime - seg.startTime || this.estimateDuration(seg.text);
            seg.endTime = currentTime + duration;
            currentTime = seg.endTime;
            return seg;
          });
          
          scriptData.metadata = scriptData.metadata || {};
          scriptData.metadata.totalDuration = currentTime;
          
        } catch (e) {
          console.warn('[ScriptGenerator] JSON 파싱 실패, 기본 형식으로 변환:', e.message);
          // JSON 파싱 실패 시 기본 형식으로 변환
          scriptData = this.convertToStructuredFormat(scriptText);
        }
        
        // JSON과 텍스트 버전 모두 저장
        const timestamp = Date.now();
        const jsonFilename = `script_${timestamp}.json`;
        const txtFilename = `script_${timestamp}.txt`;
        
        fs.writeFileSync(
          path.join(this.outputDir, jsonFilename),
          JSON.stringify(scriptData, null, 2),
          'utf8'
        );
        
        // 텍스트 버전도 저장 (하위 호환성)
        const textVersion = this.formatScriptAsText(scriptData);
        fs.writeFileSync(
          path.join(this.outputDir, txtFilename),
          textVersion,
          'utf8'
        );
        
        return {
          success: true,
          script: scriptData,
          scriptText: textVersion,
          jsonFile: jsonFilename,
          txtFile: txtFilename,
          jsonUrl: `/outputs/scripts/${jsonFilename}`,
          txtUrl: `/outputs/scripts/${txtFilename}`,
          filepath: path.join(this.outputDir, jsonFilename),
          url: `/outputs/scripts/${jsonFilename}`, // 기본은 JSON
        };
      }

      return {
        success: false,
        error: resp?.error || 'Failed to generate script',
      };
    } catch (error) {
      console.error('Script generation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // 구조화된 형식으로 변환 (JSON 파싱 실패 시)
  convertToStructuredFormat(text) {
    const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    const segments = [];
    let currentTime = 0;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed) {
        const duration = this.estimateDuration(trimmed);
        
        segments.push({
          id: `segment-${index + 1}`,
          startTime: currentTime,
          endTime: currentTime + duration,
          text: trimmed,
          tts: {
            pronunciation: trimmed,
            tone: index === 0 ? "친근함" : "교육적",
            speed: "normal",
            emotion: index === 0 ? "welcoming" : "calm",
            pitch: "normal",
            volume: "normal"
          }
        });
        
        currentTime += duration;
      }
    });
    
    return {
      metadata: {
        title: "Generated Script",
        totalDuration: currentTime,
        language: "ko"
      },
      segments: segments
    };
  }
  
  // 텍스트 길이로 말하기 시간 추정 (한국어 기준: 초당 3-4자)
  estimateDuration(text) {
    const charCount = text.length;
    const secondsPerChar = 0.3; // 초당 약 3.3자
    return Math.max(2, Math.ceil(charCount * secondsPerChar));
  }
  
  // 구조화된 데이터를 텍스트로 변환
  formatScriptAsText(scriptData) {
    let text = `# ${scriptData.metadata?.title || 'Script'}\n\n`;
    
    scriptData.segments.forEach(segment => {
      const start = this.formatTime(segment.startTime);
      const end = this.formatTime(segment.endTime);
      text += `[${start}-${end}] ${segment.text}\n`;
      
      if (segment.tts) {
        const tts = segment.tts;
        if (tts.speed && tts.speed !== 'normal') {
          text += `  - speed: ${tts.speed}\n`;
        }
        if (tts.pitch && tts.pitch !== 'normal') {
          text += `  - pitch: ${tts.pitch}\n`;
        }
        if (tts.tone && tts.tone !== 'normal') {
          text += `  - tone: ${tts.tone}\n`;
        }
        if (tts.emotion && tts.emotion !== 'neutral') {
          text += `  - emotion: ${tts.emotion}\n`;
        }
      }
      text += '\n';
    });
    
    return text;
  }
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async generateScriptFromHistory(history) {
    // Extract conversation history (last 20 messages)
    const conversationHistory = history.slice(-20);
    return this.generateScript(conversationHistory);
  }
}

module.exports = new ScriptGenerator();

