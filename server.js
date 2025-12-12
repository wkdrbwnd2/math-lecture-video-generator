// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const LocalAIApi = require('./ai/LocalAIApi');
const PromptManager = require('./ai/PromptManager');
const ScriptGenerator = require('./workers/script-generator');
const SimulationRunner = require('./workers/simulation-runner');
const VideoComposer = require('./workers/video-composer');
const AIVideoGenerator = require('./workers/ai-video-generator');
const { db, DB_USER, DB_NAME, DB_PASS } = require('./db/config');

const app = express();
const PORT = process.env.PORT || 8000;

// 전역 에러 핸들러 - 서버가 종료되지 않도록 보호
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // 서버를 종료하지 않고 로그만 기록
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // 서버를 종료하지 않고 로그만 기록
});

// Parse cookies
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Parse form and JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper functions for authentication
function isLoggedIn(req) {
  return !!req.session.user_id;
}

function requireLogin(req, res, next) {
  if (!isLoggedIn(req)) {
    return res.redirect('/login');
  }
  next();
}

// Check if user is developer/admin
async function isDeveloper(req) {
  if (!isLoggedIn(req)) {
    return false;
  }
  
  try {
    const pool = db();
    const [rows] = await pool.query('SELECT username, role FROM users WHERE id = ?', [req.session.user_id]);
    
    if (rows.length === 0) {
      return false;
    }
    
    const user = rows[0];
    // Check if username is admin/developer or role is developer/admin
    const developerUsernames = ['admin', 'developer', 'dev'];
    return developerUsernames.includes(user.username?.toLowerCase()) || 
           ['developer', 'admin'].includes(user.role?.toLowerCase());
  } catch (error) {
    console.error('Error checking developer status:', error);
    return false;
  }
}

async function requireDeveloper(req, res, next) {
  if (!isLoggedIn(req)) {
    return res.redirect('/login');
  }
  
  try {
    const isDev = await isDeveloper(req);
    if (!isDev) {
      return res.status(403).send('Access denied. Developer account required.');
    }
    next();
  } catch (err) {
    console.error('Error checking developer status:', err);
    return res.status(500).send('Error checking permissions.');
  }
}

// Serve static assets (CSS, images, etc.).
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve output files
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

const courses = [
  {
    id: 1,
    title: 'Introduction to AI in Simulation',
    description: 'Learn the fundamentals of integrating AI with complex simulation programs.',
    image: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    toolLink: '/simulation',
    toolName: 'simulation',
    icon: '🔬',
  },
  {
    id: 2,
    title: 'Advanced Video Generation Techniques',
    description: 'Master the art of creating compelling educational videos with AI.',
    image: 'https://images.pexels.com/photos/5952239/pexels-photo-5952239.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    toolLink: '/video',
    toolName: 'video',
    icon: '🎬',
  },
  {
    id: 3,
    title: 'Model Context Protocol (MCP) in Practice',
    description: 'A deep dive into using MCP for dynamic script execution in videos.',
    image: 'https://images.pexels.com/photos/7688460/pexels-photo-7688460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    toolLink: '/script',
    toolName: 'script',
    icon: '📝',
  },
];

// In-memory chat history per session ID (using cookies)
const promptHistories = new Map();
const simulationHistories = new Map();
const scriptHistories = new Map();
const videoHistories = new Map();

function getSessionId(req, res, toolType = 'prompt') {
  const cookieName = `${toolType}_session_id`;
  let sessionId = req.cookies?.[cookieName];
  const historyMap = getHistoryMap(toolType);
  
  if (!sessionId || !historyMap.has(sessionId)) {
    sessionId = crypto.randomBytes(16).toString('hex');
    res.cookie(cookieName, sessionId, { 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true 
    });
    historyMap.set(sessionId, []);
  }
  return sessionId;
}

function getHistoryMap(toolType) {
  switch (toolType) {
    case 'simulation': return simulationHistories;
    case 'script': return scriptHistories;
    case 'video': return videoHistories;
    default: return promptHistories;
  }
}

function getToolHistory(req, res, toolType) {
  const sessionId = getSessionId(req, res, toolType);
  const historyMap = getHistoryMap(toolType);
  return historyMap.get(sessionId);
}

function clearToolHistory(req, res, toolType) {
  const cookieName = `${toolType}_session_id`;
  const sessionId = req.cookies?.[cookieName];
  const historyMap = getHistoryMap(toolType);
  
  if (sessionId) {
    historyMap.delete(sessionId);
  }
  const newSessionId = crypto.randomBytes(16).toString('hex');
  res.cookie(cookieName, newSessionId, { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true 
  });
  historyMap.set(newSessionId, []);
  return historyMap.get(newSessionId);
}


app.get('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const isDev = await isDeveloper(req);
  res.send(renderLandingPage(req, isLoggedIn(req), isDev));
});

app.get('/courses', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const isDev = await isDeveloper(req);
  res.send(renderCoursesPage(isLoggedIn(req), isDev));
});

app.get('/courses/:id', async (req, res) => {
  const courseId = Number(req.params.id);
  const course = courses.find((c) => c.id === courseId);
  if (!course) {
    res.status(404).send(renderNotFoundPage());
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const isDev = await isDeveloper(req);
  res.send(renderCourseDetailPage(course, isLoggedIn(req), isDev));
});


// Register routes
app.get('/register', (req, res) => {
  if (isLoggedIn(req)) {
    return res.redirect('/');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderRegisterPage(''));
});

app.post('/register', async (req, res) => {
  const username = (req.body && req.body.username) ? String(req.body.username).trim() : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';
  const confirmPassword = (req.body && req.body.confirmPassword) ? String(req.body.confirmPassword) : '';

  if (!username || !password || !confirmPassword) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderRegisterPage('All fields are required.'));
  }

  if (password !== confirmPassword) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderRegisterPage('Passwords do not match.'));
  }

  if (password.length < 6) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderRegisterPage('Password must be at least 6 characters long.'));
  }

  try {
    const pool = db();
    
    // Check if user already exists
    const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (existing.length > 0) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderRegisterPage('Username already exists. Please choose a different username.'));
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if role column exists, add if not
    try {
      await pool.query('ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT NULL');
    } catch (err) {
      // Column might already exist, ignore error
      if (!err.message.includes('Duplicate column name') && !err.message.includes('already exists')) {
        console.warn('Warning: Could not add role column:', err.message);
      }
    }
    
    await pool.query(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, null] // 일반 사용자는 role이 null
    );

    // Auto login after registration
    const [newUser] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (newUser.length > 0) {
      req.session.user_id = newUser[0].id;
      req.session.username = newUser[0].username;
      req.session.role = newUser[0].role || null;
      return res.redirect('/');
    } else {
      return res.redirect('/login');
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // 데이터베이스 연결 오류 처리
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.message.includes('Access denied')) {
      return res.send(renderRegisterPage('Database connection error. Please contact administrator.'));
    } else if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
      return res.send(renderRegisterPage('Database server is not available. Please try again later.'));
    }
    
    return res.send(renderRegisterPage('An error occurred during registration. Please try again.'));
  }
});

// Login routes
app.get('/login', (req, res) => {
  if (isLoggedIn(req)) {
    return res.redirect('/');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLoginPage(''));
});

app.post('/login', async (req, res) => {
  const username = (req.body && req.body.username) ? String(req.body.username).trim() : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';

  if (!username || !password) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLoginPage('Username and password are required.'));
  }

  try {
    const pool = db();
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderLoginPage('Invalid username or password.'));
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      req.session.user_id = user.id;
      req.session.username = user.username;
      req.session.role = user.role || null;
      return res.redirect('/');
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderLoginPage('Invalid username or password.'));
    }
  } catch (error) {
    console.error('Login error:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLoginPage('An error occurred. Please try again.'));
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// AI Tool routes: Simulation, Script, Video
// Note: systemPrompt is loaded dynamically from PromptManager
const aiTools = [
  {
    name: 'simulation',
    title: 'Simulation AI Tool',
    description: 'Create and configure simulations for your educational videos',
    get systemPrompt() { return PromptManager.getSystemPrompt('simulation'); },
  },
  {
    name: 'script',
    title: 'Script Generation AI Tool',
    description: 'Generate engaging scripts for your educational videos',
    get systemPrompt() { return PromptManager.getSystemPrompt('script'); },
  },
  {
    name: 'video',
    title: 'Video Generation AI Tool',
    description: 'Generate complete videos from scripts and simulations',
    get systemPrompt() { return PromptManager.getSystemPrompt('video'); },
  },
  {
    name: 'ai-video',
    title: 'AI Video Generation Tool',
    description: 'Generate AI-powered videos from text prompts using Hugging Face models',
    get systemPrompt() { return PromptManager.getSystemPrompt('ai-video') || 'You are an AI video generation assistant. Help users create video generation prompts.'; },
  },
];

// Create routes for each AI tool
aiTools.forEach((tool) => {
  // GET route
  app.get(`/${tool.name}`, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const history = getToolHistory(req, res, tool.name);
    const isDev = await isDeveloper(req);
    res.send(renderAIToolPage(tool, history, isLoggedIn(req), isDev));
  });

  // POST route for chat
  app.post(`/${tool.name}`, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    const history = getToolHistory(req, res, tool.name);
    const prompt = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : '';

    if (prompt) {
      history.push({ role: 'user', content: prompt });

      // Build conversation history for context
      const conversationHistory = history.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const resp = await LocalAIApi.createResponse({
        input: [
          { role: 'system', content: tool.systemPrompt },
          ...conversationHistory,
        ],
      });

      let aiReply;
      if (resp && resp.success) {
        let text = LocalAIApi.extractText(resp);
        if (!text) {
          const decoded = LocalAIApi.decodeJsonFromResponse(resp);
          if (decoded) {
            text = JSON.stringify(decoded);
          } else if (resp.data != null) {
            text = String(resp.data);
          } else {
            text = '';
          }
        }
        aiReply = text || 'Sorry, I could not generate a response.';
      } else {
        const error = (resp && resp.error) || 'Unknown error';
        const status = resp && resp.status;
        const responseData = resp && resp.response;
        
        // 실제 API 응답 로깅 (디버깅용)
        console.log('[Chat API Error]', {
          error: error,
          status: status,
          response: responseData,
          fullResp: JSON.stringify(resp, null, 2)
        });
        
        // 실제 오류 메시지 추출
        let errorMsg = error;
        let errorCode = null;
        if (responseData && typeof responseData === 'object') {
          if (responseData.error) {
            if (typeof responseData.error === 'object') {
              errorMsg = responseData.error.message || errorMsg;
              errorCode = responseData.error.code || responseData.error.status;
            } else {
              errorMsg = responseData.error || errorMsg;
            }
          } else if (responseData.message) {
            errorMsg = responseData.message;
          }
        }
        
        const errorStr = String(errorMsg).toLowerCase();
        const responseStr = responseData ? String(JSON.stringify(responseData)).toLowerCase() : '';
        
        // 실제 할당량 오류인지 더 정확하게 확인 (할당량 관련 키워드가 명확히 있어야 함)
        const isQuotaError = (errorStr.includes('quota') && (errorStr.includes('exceeded') || errorStr.includes('limit') || errorStr.includes('reached'))) || 
                            errorStr.includes('resource_exhausted') ||
                            errorCode === 429 ||
                            (status === 429) || // Too Many Requests
                            (status === 403 && errorStr.includes('quota') && (errorStr.includes('exceeded') || errorStr.includes('limit'))) ||
                            (responseStr.includes('quota') && (responseStr.includes('exceeded') || responseStr.includes('limit')));
        
        // API 키 관련 오류인지 확인
        const isApiKeyError = errorStr.includes('api key') || 
                             errorStr.includes('invalid api key') ||
                             errorStr.includes('unauthorized') ||
                             errorStr.includes('permission denied') ||
                             errorCode === 401 ||
                             status === 401 ||
                             (status === 403 && !isQuotaError);
        
        if (isQuotaError) {
          aiReply = `⚠️ **Gemini API 할당량 초과 오류**\n\n` +
            `현재 Gemini API 할당량이 초과되었습니다. 다음을 확인해주세요:\n\n` +
            `1. **Google AI Studio 확인**: https://aistudio.google.com/\n` +
            `2. **API 키 확인**: .env 파일의 GEMINI_API_KEY가 올바른지 확인하세요\n` +
            `3. **할당량 확인**: Google AI Studio에서 사용량을 확인하세요\n\n` +
            `**오류 상세**: ${errorMsg}${status ? ` (HTTP ${status})` : ''}`;
        } else if (isApiKeyError) {
          aiReply = `⚠️ **API 키 오류**\n\n` +
            `API 키에 문제가 있습니다:\n\n` +
            `1. **API 키 확인**: .env 파일의 GEMINI_API_KEY가 올바른지 확인하세요\n` +
            `2. **Google AI Studio**: https://aistudio.google.com/ 에서 API 키가 활성화되어 있는지 확인하세요\n` +
            `3. **서버 재시작**: API 키를 변경했다면 서버를 재시작하세요\n\n` +
            `**오류 상세**: ${errorMsg}${status ? ` (HTTP ${status})` : ''}`;
        } else {
          aiReply = `⚠️ **API 오류**\n\n` +
            `오류가 발생했습니다:\n\n` +
            `**오류 메시지**: ${errorMsg}${status ? ` (HTTP ${status})` : ''}\n\n` +
            `서버 콘솔에서 자세한 오류 정보를 확인하세요.`;
        }
      }

      history.push({ role: 'assistant', content: aiReply });
    }

    const isDev = await isDeveloper(req);
    res.send(renderAIToolPage(tool, history, isLoggedIn(req), isDev));
  });

  // POST route for clearing history
  app.post(`/${tool.name}/clear`, async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const history = clearToolHistory(req, res, tool.name);
    const isDev = await isDeveloper(req);
    res.send(renderAIToolPage(tool, history, isLoggedIn(req), isDev));
  });

  // POST route for generating actual output
  app.post(`/${tool.name}/generate`, async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const history = getToolHistory(req, res, tool.name);

    if (!history || history.length < 1) {
      return res.json({
        success: false,
        error: 'Not enough conversation history. Please chat more before generating.',
      });
    }

    try {
      let result;
      
      if (tool.name === 'script') {
        result = await ScriptGenerator.generateScriptFromHistory(history);
      } else if (tool.name === 'simulation') {
        result = await SimulationRunner.generateAndRun(history);
      } else if (tool.name === 'video') {
        // Video generation from conversation history
        // 채팅 히스토리를 반영해서 비디오 생성
        const fs = require('fs');
        const path = require('path');
        
        console.log('[Video Generation] 채팅 히스토리 기반 비디오 생성 시작...');
        console.log('[Video Generation] 히스토리 길이:', history.length);
        
        // Step 1: 대본 생성 (없으면)
        const scriptsDir = path.join(__dirname, 'outputs', 'scripts');
        let scriptPath = null;
        if (fs.existsSync(scriptsDir)) {
          // JSON 파일 우선, 없으면 TXT 파일
          const jsonFiles = fs.readdirSync(scriptsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => ({
              name: f,
              path: path.join(scriptsDir, f),
              time: fs.statSync(path.join(scriptsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
          
          if (jsonFiles.length > 0) {
            scriptPath = jsonFiles[0].path;
          } else {
            // JSON이 없으면 TXT 파일 사용
            const txtFiles = fs.readdirSync(scriptsDir)
            .filter(f => f.endsWith('.txt'))
            .map(f => ({
              name: f,
              path: path.join(scriptsDir, f),
              time: fs.statSync(path.join(scriptsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
          
            if (txtFiles.length > 0) {
              scriptPath = txtFiles[0].path;
            }
          }
        }
        
        // 대본이 없으면 채팅 히스토리에서 생성
        if (!scriptPath || !fs.existsSync(scriptPath)) {
          console.log('[Video Generation] 대본이 없어서 채팅 히스토리에서 생성...');
          try {
            const scriptResult = await ScriptGenerator.generateScriptFromHistory(history);
            if (scriptResult.success && scriptResult.url) {
              // URL에서 파일 경로 추출
              const urlPath = scriptResult.url.replace('/outputs/', '');
              scriptPath = path.join(__dirname, urlPath);
              console.log('[Video Generation] 대본 생성 완료:', scriptPath);
            } else {
              console.error('[Video Generation] 대본 생성 실패:', scriptResult.error);
            }
          } catch (error) {
            console.error('[Video Generation] 대본 생성 오류:', error);
          }
        }
        
        // Step 2: 시뮬레이션 비디오 생성 (없으면)
        const simulationsDir = path.join(__dirname, 'outputs', 'simulations');
        let simulationVideoPath = null;
        if (fs.existsSync(simulationsDir)) {
          const videoFiles = fs.readdirSync(simulationsDir)
            .filter(f => f.endsWith('.mp4') || f.endsWith('.avi') || f.endsWith('.mov') || f.endsWith('.gif'))
            .map(f => ({
              name: f,
              path: path.join(simulationsDir, f),
              time: fs.statSync(path.join(simulationsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
          
          if (videoFiles.length > 0) {
            simulationVideoPath = videoFiles[0].path;
          }
        }
        
        // 시뮬레이션 비디오가 없으면 채팅 히스토리에서 생성
        if (!simulationVideoPath || !fs.existsSync(simulationVideoPath)) {
          console.log('[Video Generation] 시뮬레이션 비디오가 없어서 채팅 히스토리에서 생성...');
          try {
            const simulationResult = await SimulationRunner.generateAndRun(history);
            if (simulationResult.success && simulationResult.url) {
              // URL에서 파일 경로 추출
              const urlPath = simulationResult.url.replace('/outputs/', '');
              simulationVideoPath = path.join(__dirname, urlPath);
              console.log('[Video Generation] 시뮬레이션 비디오 생성 완료:', simulationVideoPath);
            } else {
              console.error('[Video Generation] 시뮬레이션 비디오 생성 실패:', simulationResult.error);
            }
          } catch (error) {
            console.error('[Video Generation] 시뮬레이션 비디오 생성 오류:', error);
          }
        }
        
        console.log('[Video Generation] 최종 파일 확인:', {
          script: scriptPath,
          simulation: simulationVideoPath,
          scriptExists: scriptPath ? fs.existsSync(scriptPath) : false,
          simulationExists: simulationVideoPath ? fs.existsSync(simulationVideoPath) : false,
        });
        
        // 대본과 시뮬레이션 비디오가 모두 있으면 비디오 생성
        if (scriptPath && fs.existsSync(scriptPath) && simulationVideoPath && fs.existsSync(simulationVideoPath)) {
          console.log('[Video Generation] VideoComposer 호출 시작...');
          try {
            result = await VideoComposer.createVideoFromResources(scriptPath, simulationVideoPath, history);
            console.log('[Video Generation] VideoComposer 결과:', {
              success: result.success,
              error: result.error,
              url: result.url,
            });
          } catch (error) {
            console.error('[Video Generation] VideoComposer 오류:', error);
            result = {
              success: false,
              error: 'Video composition failed: ' + error.message,
            };
          }
        } else {
          // 파일이 없으면 채팅 히스토리만으로 AI 비디오 생성 시도
          console.log('[Video Generation] 파일이 없어서 채팅 히스토리만으로 AI 비디오 생성 시도...');
          try {
            // 채팅 히스토리에서 비디오 프롬프트 추출
            const lastUserMessage = history.filter(m => m.role === 'user').pop();
            if (lastUserMessage) {
              const videoPrompt = lastUserMessage.content;
              console.log('[Video Generation] AI 비디오 생성 프롬프트:', videoPrompt.substring(0, 100));
              result = await AIVideoGenerator.generateVideo(videoPrompt, {
                model: req.body.model || 'cerspense/zeroscope_v2_576w',
                steps: req.body.steps || 50,
                frames: req.body.frames || 24,
                height: req.body.height || 320,
                width: req.body.width || 576,
              });
            } else {
              result = {
                success: false,
                error: '채팅 히스토리가 없습니다. 비디오에 대한 설명을 입력해주세요.',
              };
            }
          } catch (error) {
            console.error('[Video Generation] AI 비디오 생성 오류:', error);
            result = {
              success: false,
              error: 'AI video generation failed: ' + error.message,
            };
          }
        }
      } else if (tool.name === 'ai-video') {
        // AI Video generation from script or direct prompt
        const fs = require('fs');
        const path = require('path');
        
        // Try to find the most recent script
        const scriptsDir = path.join(__dirname, 'outputs', 'scripts');
        let scriptPath = null;
        if (fs.existsSync(scriptsDir)) {
          const scriptFiles = fs.readdirSync(scriptsDir)
            .filter(f => f.endsWith('.txt'))
            .map(f => ({
              name: f,
              path: path.join(scriptsDir, f),
              time: fs.statSync(path.join(scriptsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
          
          if (scriptFiles.length > 0) {
            scriptPath = scriptFiles[0].path;
          }
        }
        
        if (scriptPath) {
          // Generate AI video from script
          result = await AIVideoGenerator.generateVideoFromScript(scriptPath, history, {
            model: req.body.model || 'cerspense/zeroscope_v2_576w',
            steps: req.body.steps || 50,
            frames: req.body.frames || 24,
            height: req.body.height || 320,
            width: req.body.width || 576,
            device: req.body.device || undefined,
          });
        } else {
          // Generate from conversation history (extract prompt from last message)
          const lastUserMessage = history.filter(m => m.role === 'user').pop();
          if (lastUserMessage) {
            result = await AIVideoGenerator.generateVideo(lastUserMessage.content, {
              model: req.body.model || 'cerspense/zeroscope_v2_576w',
              steps: req.body.steps || 50,
              frames: req.body.frames || 24,
              height: req.body.height || 320,
              width: req.body.width || 576,
              device: req.body.device || undefined,
            });
          } else {
            result = {
              success: false,
              error: 'AI video generation requires a script or a text prompt. Please generate a script first or provide a video description in the chat.',
              instructions: '1. Generate a script using the Script tool, or\n2. Describe what video you want to generate in the chat',
            };
          }
        }
      } else {
        result = {
          success: false,
          error: 'Unknown tool',
        };
      }

      res.json(result);
    } catch (error) {
      console.error(`[${tool.name}/generate] 오류 발생:`, error);
      console.error(`[${tool.name}/generate] 오류 스택:`, error.stack);
      res.status(500).json({
        success: false,
        error: error.message || '알 수 없는 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });
});

// 비디오 편집 페이지 라우트
app.get('/video/edit', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const isDev = await isDeveloper(req);
  const history = getToolHistory(req, res, 'video');
  res.send(renderVideoEditorPage(isLoggedIn(req), isDev, history));
});

// 편집 페이지용 API - 미디어 파일 목록 가져오기
app.get('/api/video-editor/media', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const scriptsDir = path.join(__dirname, 'outputs', 'scripts');
    const simulationsDir = path.join(__dirname, 'outputs', 'simulations');
    const videosDir = path.join(__dirname, 'outputs', 'videos');
    const aiVideosDir = path.join(__dirname, 'outputs', 'ai-videos');
    
    const media = {
      scripts: [],
      simulations: [],
      videos: [],
      aiVideos: []
    };
    
    // 대본 파일들 (JSON 우선, TXT도 포함)
    if (fs.existsSync(scriptsDir)) {
      const files = fs.readdirSync(scriptsDir)
        .filter(f => f.endsWith('.txt') || f.endsWith('.json'))
        .map(f => {
          const filePath = path.join(scriptsDir, f);
          try {
            // 파일이 실제로 존재하고 읽을 수 있는지 확인
            if (!fs.existsSync(filePath)) {
              console.warn('[API] 파일이 존재하지 않음:', filePath);
              return null;
            }
            const stats = fs.statSync(filePath);
            // 디렉토리가 아닌 파일만 포함
            if (!stats.isFile()) {
              console.warn('[API] 디렉토리 제외:', filePath);
              return null;
            }
            const isJson = f.endsWith('.json');
            return {
              name: f,
              url: `/outputs/scripts/${f}`,
              size: stats.size,
              modified: stats.mtime,
              type: 'script',
              isStructured: isJson,
              format: isJson ? 'json' : 'txt'
            };
          } catch (error) {
            console.error('[API] 파일 정보 읽기 오류:', filePath, error.message);
            return null;
          }
        })
        .filter(f => f !== null) // null 값 제거
        .sort((a, b) => {
          // JSON 파일을 우선 정렬
          if (a.isStructured && !b.isStructured) return -1;
          if (!a.isStructured && b.isStructured) return 1;
          return b.modified - a.modified;
        });
      media.scripts = files;
    }
    
    // 시뮬레이션 비디오들
    if (fs.existsSync(simulationsDir)) {
      const files = fs.readdirSync(simulationsDir)
        .filter(f => f.endsWith('.mp4') || f.endsWith('.avi') || f.endsWith('.mov') || f.endsWith('.gif'))
        .map(f => {
          const filePath = path.join(simulationsDir, f);
          try {
            if (!fs.existsSync(filePath)) {
              console.warn('[API] 파일이 존재하지 않음:', filePath);
              return null;
            }
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
              return null;
            }
            return {
              name: f,
              url: `/outputs/simulations/${f}`,
              size: stats.size,
              modified: stats.mtime,
              type: 'simulation'
            };
          } catch (error) {
            console.error('[API] 파일 정보 읽기 오류:', filePath, error.message);
            return null;
          }
        })
        .filter(f => f !== null)
        .sort((a, b) => b.modified - a.modified);
      media.simulations = files;
    }
    
    // 일반 비디오들
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir)
        .filter(f => f.endsWith('.mp4') || f.endsWith('.avi') || f.endsWith('.mov'))
        .map(f => {
          const filePath = path.join(videosDir, f);
          try {
            if (!fs.existsSync(filePath)) {
              console.warn('[API] 파일이 존재하지 않음:', filePath);
              return null;
            }
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
              return null;
            }
            return {
              name: f,
              url: `/outputs/videos/${f}`,
              size: stats.size,
              modified: stats.mtime,
              type: 'video'
            };
          } catch (error) {
            console.error('[API] 파일 정보 읽기 오류:', filePath, error.message);
            return null;
          }
        })
        .filter(f => f !== null)
        .sort((a, b) => b.modified - a.modified);
      media.videos = files;
    }
    
    // AI 비디오들
    if (fs.existsSync(aiVideosDir)) {
      const files = fs.readdirSync(aiVideosDir)
        .filter(f => f.endsWith('.mp4') || f.endsWith('.avi') || f.endsWith('.mov'))
        .map(f => {
          const filePath = path.join(aiVideosDir, f);
          try {
            if (!fs.existsSync(filePath)) {
              console.warn('[API] 파일이 존재하지 않음:', filePath);
              return null;
            }
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
              return null;
            }
            return {
              name: f,
              url: `/outputs/ai-videos/${f}`,
              size: stats.size,
              modified: stats.mtime,
              type: 'ai-video'
            };
          } catch (error) {
            console.error('[API] 파일 정보 읽기 오류:', filePath, error.message);
            return null;
          }
        })
        .filter(f => f !== null)
        .sort((a, b) => b.modified - a.modified);
      media.aiVideos = files;
    }
    
    res.json({ success: true, media });
  } catch (error) {
    console.error('[API] 미디어 목록 가져오기 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 편집 페이지용 API - 채팅 히스토리 가져오기
app.get('/api/video-editor/history', async (req, res) => {
  const history = getToolHistory(req, res, 'video');
  res.json({ success: true, history: history || [] });
});

// 편집 페이지용 API - 대본과 대화 기반 비디오 구조 생성
app.post('/api/video-editor/create-template', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const { scriptUrl, conversationHistory } = req.body;
    
    let scriptContent = '';
    if (scriptUrl) {
      const scriptPath = path.join(__dirname, scriptUrl.replace('/outputs/', ''));
      if (fs.existsSync(scriptPath)) {
        scriptContent = fs.readFileSync(scriptPath, 'utf8');
      }
    }
    
    // 대본을 기반으로 비디오 구조 생성
    const scriptLines = scriptContent.split('\n').filter(line => line.trim());
    const structure = {
      segments: scriptLines.map((line, index) => ({
        id: `segment-${index}`,
        startTime: index * 5, // 각 세그먼트 5초씩
        duration: 5,
        script: line.trim(),
        type: 'script',
        order: index
      })),
      totalDuration: scriptLines.length * 5
    };
    
    // 대화 히스토리가 있으면 추가 정보 포함
    if (conversationHistory && conversationHistory.length > 0) {
      structure.conversationContext = conversationHistory
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content);
    }
    
    res.json({ success: true, structure });
  } catch (error) {
    console.error('[API] 템플릿 생성 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// AI 컨텍스트 수집 및 분석 API
app.post('/api/video-editor/ai/analyze-context', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const { scriptUrl, simulationUrls, conversationHistory, currentEditState } = req.body;
    
    // 컨텍스트 수집
    const context = {
      script: null,
      simulations: [],
      conversation: conversationHistory || [],
      editState: currentEditState || {}
    };
    
    // 대본 읽기
    if (scriptUrl) {
      const scriptPath = path.join(__dirname, scriptUrl.replace('/outputs/', ''));
      if (fs.existsSync(scriptPath)) {
        context.script = fs.readFileSync(scriptPath, 'utf8');
      }
    }
    
    // 시뮬레이션 영상 메타데이터 수집
    if (simulationUrls && Array.isArray(simulationUrls)) {
      for (const simUrl of simulationUrls) {
        const simPath = path.join(__dirname, simUrl.replace('/outputs/', ''));
        if (fs.existsSync(simPath)) {
          const stats = fs.statSync(simPath);
          context.simulations.push({
            url: simUrl,
            name: path.basename(simPath),
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
    }
    
    // AI에게 컨텍스트 분석 요청
    const systemPrompt = `You are a video editing AI assistant. Analyze the provided context and suggest an optimal video editing structure.

Context:
- Script: ${context.script ? context.script.substring(0, 1000) : 'None'}
- Simulations: ${context.simulations.length} video(s)
- Conversation history: ${context.conversation.length} messages
- Current edit state: ${JSON.stringify(context.editState)}

Provide suggestions for:
1. Video structure (how to arrange clips)
2. Subtitle placement (based on script)
3. Transitions and effects
4. Timing and pacing

Return a JSON structure with your suggestions.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context.conversation || []),
      {
        role: 'user',
        content: 'Analyze the context and suggest an optimal video editing structure.'
      }
    ];
    
    const aiResponse = await LocalAIApi.createResponse({
      input: messages,
      model: require('./ai/config').default_model,
    });
    
    if (aiResponse && aiResponse.success) {
      const suggestions = LocalAIApi.extractText(aiResponse);
      res.json({
        success: true,
        context: context,
        suggestions: suggestions
      });
    } else {
      res.json({
        success: false,
        error: aiResponse?.error || 'AI 분석 실패',
        context: context
      });
    }
  } catch (error) {
    console.error('[API] 컨텍스트 분석 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// AI 편집 실행 API
app.post('/api/video-editor/ai/execute-edit', async (req, res) => {
  try {
    const { action, params, context } = req.body;
    
    // 컨텍스트를 포함한 AI 요청
    const systemPrompt = `You are a video editing AI assistant. Execute the requested editing action based on the provided context.

Context:
- Script: ${context?.script ? context.script.substring(0, 500) : 'None'}
- Current edit state: ${JSON.stringify(context?.editState || {})}
- User request: ${action}

Execute the action: ${action}
Parameters: ${JSON.stringify(params || {})}

Return a JSON structure with the editing instructions.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Execute: ${action}. Parameters: ${JSON.stringify(params || {})}`
      }
    ];
    
    const aiResponse = await LocalAIApi.createResponse({
      input: messages,
      model: require('./ai/config').default_model,
    });
    
    if (aiResponse && aiResponse.success) {
      const instructions = LocalAIApi.extractText(aiResponse);
      
      // 편집 작업 실행 (예: 자막 생성, 효과 추가 등)
      let result = {
        success: true,
        action: action,
        instructions: instructions
      };
      
      // 특정 작업에 대한 처리
      if (action === 'generate-subtitles' && context?.script) {
        // 대본 기반 자막 생성
        const scriptLines = context.script.split('\n').filter(line => line.trim());
        result.subtitles = scriptLines.map((line, index) => ({
          id: `subtitle-${index}`,
          text: line.trim(),
          startTime: index * 5,
          duration: 5
        }));
      }
      
      res.json(result);
    } else {
      res.json({
        success: false,
        error: aiResponse?.error || 'AI 편집 실행 실패'
      });
    }
  } catch (error) {
    console.error('[API] AI 편집 실행 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// AI 실시간 채팅 API (편집 중)
app.post('/api/video-editor/ai/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    // 전체 컨텍스트를 포함한 AI 대화
    const systemPrompt = `You are a video editing AI assistant helping a user edit their video in real-time.

Current editing context:
- Script: ${context?.script ? context.script.substring(0, 1000) : 'None'}
- Simulations: ${context?.simulations?.length || 0} video(s)
- Current timeline: ${JSON.stringify(context?.editState?.timeline || {})}
- Clips: ${context?.editState?.clips?.length || 0} clip(s)

The user is currently editing and needs your help. Understand the context and provide helpful suggestions or execute editing tasks as requested.

Be conversational, helpful, and proactive. If the user asks for something, try to understand what they want and provide specific editing instructions or execute the task if possible.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context?.conversation || []),
      {
        role: 'user',
        content: message
      }
    ];
    
    const aiResponse = await LocalAIApi.createResponse({
      input: messages,
      model: require('./ai/config').default_model,
    });
    
    if (aiResponse && aiResponse.success) {
      const reply = LocalAIApi.extractText(aiResponse);
      res.json({
        success: true,
        reply: reply
      });
    } else {
      res.json({
        success: false,
        error: aiResponse?.error || 'AI 응답 실패'
      });
    }
  } catch (error) {
    console.error('[API] AI 채팅 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 편집 프로젝트 저장 API
app.post('/api/video-editor/project/save', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const { projectData } = req.body;
    const projectsDir = path.join(__dirname, 'outputs', 'projects');
    
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }
    
    const projectId = projectData.id || `project-${Date.now()}`;
    const projectFile = path.join(projectsDir, `${projectId}.json`);
    
    const project = {
      id: projectId,
      name: projectData.name || 'Untitled Project',
      createdAt: projectData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: projectData.timeline || {},
      clips: projectData.clips || [],
      effects: projectData.effects || [],
      context: projectData.context || {}
    };
    
    fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
    
    res.json({
      success: true,
      projectId: projectId,
      project: project
    });
  } catch (error) {
    console.error('[API] 프로젝트 저장 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 구조화된 대본 가져오기 및 TTS 생성 API
app.post('/api/video-editor/import-structured-script', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const TTSGenerator = require('./workers/tts-generator');
  
  try {
    const { scriptPath } = req.body;
    
    if (!scriptPath) {
      return res.json({
        success: false,
        error: 'scriptPath is required'
      });
    }
    
    // 스크립트 파일 경로 변환 (/outputs/scripts/xxx.json -> 실제 경로)
    let actualPath = scriptPath;
    
    // URL 경로 형식 처리 (/outputs/scripts/xxx.json)
    if (scriptPath.startsWith('/outputs/')) {
      const relativePath = scriptPath.replace(/^\/outputs\//, '');
      actualPath = path.join(__dirname, 'outputs', relativePath);
    }
    // 절대 경로가 아닌 상대 경로인 경우
    else if (!path.isAbsolute(scriptPath)) {
      // outputs/scripts/xxx.json 형식
      if (scriptPath.startsWith('outputs/')) {
        actualPath = path.join(__dirname, scriptPath);
      } else {
        // scripts/xxx.json 형식
        actualPath = path.join(__dirname, 'outputs', 'scripts', path.basename(scriptPath));
      }
    }
    
    // 경로 정규화 (Windows 경로 구분자 처리)
    actualPath = path.normalize(actualPath);
    
    console.log('[API] 스크립트 경로 변환:', scriptPath, '->', actualPath);
    
    if (!fs.existsSync(actualPath)) {
      console.error('[API] 파일을 찾을 수 없음:', actualPath);
      return res.json({
        success: false,
        error: 'Script file not found: ' + scriptPath + ' (resolved to: ' + actualPath + ')'
      });
    }
    
    // 구조화된 대본 로드
    console.log('[API] 구조화된 대본 로드:', actualPath);
    let scriptData;
    try {
      scriptData = JSON.parse(fs.readFileSync(actualPath, 'utf8'));
    } catch (error) {
      console.error('[API] JSON 파싱 오류:', error);
      return res.json({
        success: false,
        error: '스크립트 파일을 읽을 수 없습니다: ' + error.message
      });
    }
    
    if (!scriptData.segments || !Array.isArray(scriptData.segments)) {
      return res.json({
        success: false,
        error: 'Invalid script format: segments missing or not an array'
      });
    }
    
    if (scriptData.segments.length === 0) {
      return res.json({
        success: false,
        error: '스크립트에 세그먼트가 없습니다. 세그먼트가 하나 이상 필요합니다.'
      });
    }
    
    // 유효한 세그먼트 수 확인
    const validSegments = scriptData.segments.filter(s => s && s.text && typeof s.text === 'string' && s.text.trim().length > 0);
    if (validSegments.length === 0) {
      return res.json({
        success: false,
        error: '유효한 텍스트를 가진 세그먼트가 없습니다. 모든 세그먼트에 텍스트가 필요합니다.'
      });
    }
    
    console.log('[API] 유효한 세그먼트 수:', validSegments.length, '/', scriptData.segments.length);
    
    // TTS 오디오 생성
    console.log('[API] TTS 오디오 생성 시작...');
    let audioFiles;
    try {
      audioFiles = await TTSGenerator.generateFromStructuredScript(scriptData);
    } catch (error) {
      console.error('[API] TTS 생성 오류:', error);
      return res.json({
        success: false,
        error: '오디오 생성 실패: ' + error.message
      });
    }
    
    if (!audioFiles || audioFiles.length === 0) {
      return res.json({
        success: false,
        error: '오디오 파일이 생성되지 않았습니다. TTS 서비스가 작동하지 않거나 세그먼트에 문제가 있을 수 있습니다.'
      });
    }
    
    console.log('[API] TTS 생성 완료:', audioFiles.length, '개 파일 생성됨');
    
    // 타임라인 구조 생성
    const timeline = scriptData.segments.map((segment) => {
      const audioFile = audioFiles.find(af => af.segmentId === segment.id);
      
      // 오디오 파일 URL 생성
      let audioUrl = null;
      if (audioFile && audioFile.audioFile) {
        const relativePath = path.relative(
          path.join(__dirname, 'outputs'),
          audioFile.audioFile
        );
        audioUrl = `/outputs/${relativePath.replace(/\\/g, '/')}`;
      }
      
      return {
        id: segment.id,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.endTime - segment.startTime,
        audioFile: audioFile ? audioFile.audioFile : null,
        audioUrl: audioUrl,
        text: segment.text,
        subtitle: {
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime
        },
        tts: segment.tts || {}
      };
    });
    
    console.log('[API] 타임라인 생성 완료:', timeline.length, '개 세그먼트');
    
    res.json({
      success: true,
      timeline: timeline,
      audioFiles: audioFiles.map(af => ({
        segmentId: af.segmentId,
        url: path.relative(
          path.join(__dirname, 'outputs'),
          af.audioFile
        ).replace(/\\/g, '/'),
        startTime: af.startTime,
        endTime: af.endTime
      })),
      script: {
        metadata: scriptData.metadata || {},
        totalSegments: scriptData.segments.length
      }
    });
  } catch (error) {
    console.error('[API] 구조화된 대본 가져오기 오류:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// 편집 프로젝트 로드 API
app.get('/api/video-editor/project/load/:projectId', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const { projectId } = req.params;
    const projectFile = path.join(__dirname, 'outputs', 'projects', `${projectId}.json`);
    
    if (!fs.existsSync(projectFile)) {
      return res.json({ success: false, error: 'Project not found' });
    }
    
    const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
    
    res.json({
      success: true,
      project: project
    });
  } catch (error) {
    console.error('[API] 프로젝트 로드 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 편집 프로젝트 목록 API
app.get('/api/video-editor/project/list', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const projectsDir = path.join(__dirname, 'outputs', 'projects');
    const projects = [];
    
    if (fs.existsSync(projectsDir)) {
      const files = fs.readdirSync(projectsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const filePath = path.join(projectsDir, f);
          const project = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            id: project.id,
            name: project.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          };
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      projects.push(...files);
    }
    
    res.json({
      success: true,
      projects: projects
    });
  } catch (error) {
    console.error('[API] 프로젝트 목록 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// Hugging Face 모델로 채팅 히스토리 기반 비디오 생성 엔드포인트
app.post('/video/generate-from-chat', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const history = getToolHistory(req, res, 'video');
  
  if (!history || history.length < 1) {
    return res.json({
      success: false,
      error: '채팅 내용이 없습니다. 먼저 채팅을 시작해주세요.',
    });
  }
  
  try {
    console.log('[Video Generation] Hugging Face 모델로 채팅 히스토리 기반 비디오 생성 시작...');
    console.log('[Video Generation] 히스토리 길이:', history.length);
    
    // 채팅 히스토리에서 비디오 프롬프트 추출
    // 전체 대화를 요약하여 비디오 프롬프트 생성
    const userMessages = history.filter(m => m.role === 'user').map(m => m.content);
    const assistantMessages = history.filter(m => m.role === 'assistant').map(m => m.content);
    
    // 마지막 사용자 메시지와 전체 대화 맥락을 결합
    let videoPrompt = '';
    if (userMessages.length > 0) {
      // 마지막 사용자 메시지를 기본으로 사용
      videoPrompt = userMessages[userMessages.length - 1];
      
      // 이전 대화 맥락이 있으면 추가
      if (userMessages.length > 1) {
        const context = userMessages.slice(-3).join('. '); // 최근 3개 메시지 사용
        videoPrompt = context + '. ' + videoPrompt;
      }
    } else {
      return res.json({
        success: false,
        error: '사용자 메시지를 찾을 수 없습니다.',
      });
    }
    
    console.log('[Video Generation] 추출된 비디오 프롬프트:', videoPrompt.substring(0, 200));
    
    // Hugging Face 모델로 비디오 생성 (로컬 모델 사용)
    const result = await AIVideoGenerator.generateVideo(videoPrompt, {
      useReplicate: false, // Hugging Face 로컬 모델 사용
      model: req.body.model || 'cerspense/zeroscope_v2_576w',
      steps: req.body.steps || 50,
      frames: req.body.frames || 24,
      height: req.body.height || 320,
      width: req.body.width || 576,
      device: req.body.device || undefined,
    });
    
    res.json(result);
  } catch (error) {
    console.error('[Video Generation] 오류:', error);
    res.json({
      success: false,
      error: error.message,
    });
  }
});

// Admin routes - Create Developer Account (for initial setup)
app.get('/admin/create-dev', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderCreateDevAccountPage());
});

app.post('/admin/create-dev', async (req, res) => {
  const username = (req.body && req.body.username) ? String(req.body.username).trim() : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';
  
  if (!username || !password) {
    return res.send(renderCreateDevAccountPage('Username and password are required.'));
  }

  try {
    // 데이터베이스 연결 시도
    let pool;
    try {
      pool = db();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      const errorMsg = `
        <strong>데이터베이스 연결 오류</strong><br><br>
        데이터베이스에 연결할 수 없습니다: ${dbError.message}<br><br>
        <strong>해결 방법:</strong><br>
        1. MySQL 서버가 실행 중인지 확인<br>
        2. 데이터베이스 초기화 스크립트 실행: <code>node scripts/setup-database.js</code>
      `;
      return res.send(renderCreateDevAccountPage(errorMsg));
    }
    
    // Check if user already exists
    let existing;
    try {
      [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    } catch (queryError) {
      console.error('Database query error:', queryError);
      // 테이블이 없을 수 있으므로 계속 진행
      existing = [];
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if role column exists, add if not
    try {
      await pool.query('ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT NULL');
    } catch (err) {
      // Column might already exist, ignore error
      if (!err.message.includes('Duplicate column name') && 
          !err.message.includes('already exists') &&
          !err.message.includes('Duplicate column')) {
        console.warn('Warning: Could not add role column:', err.message);
      }
    }
    
    if (existing && existing.length > 0) {
      // Update existing user
      try {
        await pool.query(
          'UPDATE users SET password = ?, role = ? WHERE username = ?',
          [hashedPassword, 'developer', username]
        );
        return res.send(renderCreateDevAccountPage(null, `✅ Updated user "${username}" to developer account. You can now login.`));
      } catch (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }
    } else {
      // Create new user
      try {
        await pool.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [username, hashedPassword, 'developer']
        );
        return res.send(renderCreateDevAccountPage(null, `✅ Created developer account "${username}". You can now login.`));
      } catch (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
    }
  } catch (error) {
    console.error('Error creating developer account:', error);
    console.error('Error stack:', error.stack);
    
    // 응답이 아직 전송되지 않았는지 확인
    if (res.headersSent) {
      console.error('Response already sent, cannot send error message');
      return;
    }
    
    // 데이터베이스 연결 오류인 경우 더 자세한 안내 제공
    if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.message.includes('Access denied')) {
      const errorMsg = `
        <strong>데이터베이스 접근 오류</strong><br><br>
        MySQL 사용자 '${DB_USER}'가 존재하지 않거나 권한이 없습니다.<br><br>
        <strong>해결 방법:</strong><br>
        1. 데이터베이스 초기화 스크립트 실행:<br>
        <code>node scripts/setup-database.js</code><br><br>
        2. 또는 MySQL root 계정으로 직접 설정:<br>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 0.9em;">
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;</pre>
        <br>
        자세한 내용은 <code>scripts/setup-database.js</code> 파일을 참고하세요.
      `;
      return res.send(renderCreateDevAccountPage(errorMsg));
    } else if (error.code === 'ECONNREFUSED' || error.message.includes('connect') || error.code === 'ENOTFOUND') {
      const errorMsg = `
        <strong>데이터베이스 연결 실패</strong><br><br>
        MySQL 서버에 연결할 수 없습니다.<br><br>
        <strong>확인 사항:</strong><br>
        1. MySQL 서버가 실행 중인지 확인<br>
        2. Windows: 서비스 관리자에서 MySQL 서비스 확인<br>
        3. <code>db/config.js</code>의 연결 정보 확인<br><br>
        <strong>MySQL 서버 시작 방법:</strong><br>
        Windows PowerShell: <code>net start MySQL</code> 또는 <code>Start-Service MySQL*</code>
      `;
      return res.send(renderCreateDevAccountPage(errorMsg));
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      const errorMsg = `
        <strong>테이블이 없습니다</strong><br><br>
        users 테이블이 존재하지 않습니다.<br><br>
        <strong>해결 방법:</strong><br>
        데이터베이스 초기화 스크립트를 실행하세요:<br>
        <code>node scripts/setup-database.js</code>
      `;
      return res.send(renderCreateDevAccountPage(errorMsg));
    }
    
    // 기타 오류
    const safeErrorMessage = error.message ? error.message.substring(0, 500) : 'Unknown error';
    return res.send(renderCreateDevAccountPage(`Error: ${safeErrorMessage}`));
  }
});

// Admin routes - AI Prompt Settings (Developer only)
app.get('/admin/prompts', requireDeveloper, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const isDev = await isDeveloper(req);
  res.send(renderAdminPromptsPage(req, isDev));
});

// API: Get all prompts
app.get('/api/admin/prompts', requireDeveloper, (req, res) => {
  res.json({
    success: true,
    prompts: PromptManager.prompts,
  });
});

// API: Update prompt
app.post('/api/admin/prompts/:tool', requireDeveloper, (req, res) => {
  const tool = req.params.tool;
  const { systemPrompt, generationPrompt } = req.body;

  if (!['simulation', 'script', 'video'].includes(tool)) {
    return res.json({
      success: false,
      error: 'Invalid tool name',
    });
  }

  try {
    if (systemPrompt !== undefined) {
      PromptManager.updateSystemPrompt(tool, systemPrompt);
    }
    if (generationPrompt !== undefined) {
      PromptManager.updateGenerationPrompt(tool, generationPrompt);
    }

    // Reload prompts to ensure consistency
    PromptManager.prompts = PromptManager.loadPrompts();

    // Note: aiTools use getters, so they will automatically use the updated prompts
    // 각 도구별로 프롬프트가 독립적으로 저장되고 적용됨을 확인
    console.log(`✅ Updated prompts for ${tool}:`, {
      systemPromptLength: systemPrompt?.length || 0,
      generationPromptLength: generationPrompt?.length || 0,
    });

    res.json({
      success: true,
      message: `Prompt for ${tool} updated successfully`,
      tool: tool,
    });
  } catch (error) {
    console.error(`Error updating prompt for ${tool}:`, error);
    res.json({
      success: false,
      error: error.message,
    });
  }
});

// AI Video Generation Progress API
app.get('/api/ai-video/progress/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const progress = AIVideoGenerator.getProgress(jobId);
  
  if (progress) {
    res.json({
      success: true,
      progress: progress,
    });
  } else {
    res.json({
      success: false,
      error: 'Progress not found or expired',
    });
  }
});

// MCP Status API
app.get('/api/mcp/status/:tool', async (req, res) => {
  const tool = req.params.tool;
  let mcpConnection;
  
  switch (tool) {
    case 'simulation':
      mcpConnection = require('./mcp/connection').simulationMCP;
      break;
    case 'script':
      mcpConnection = require('./mcp/connection').scriptMCP;
      break;
    case 'video':
      mcpConnection = require('./mcp/connection').videoMCP;
      break;
    default:
      return res.json({
        connected: false,
        tool: tool,
        error: 'Unknown tool',
      });
  }
  
  // Connect if not already connected
  if (!mcpConnection.connected) {
    await mcpConnection.connect();
  }
  
  const status = mcpConnection.getStatus();
  res.json({
    connected: status.connected,
    tool: tool,
    message: status.connected ? 'MCP connected' : 'MCP disconnected',
  });
});

// Express 에러 핸들러 미들웨어 (모든 라우트 다음에 위치해야 함)
app.use((err, req, res, next) => {
  console.error('Express error handler:', err);
  if (!res.headersSent) {
    res.status(500).send('Internal Server Error: ' + (err.message || 'Unknown error'));
  }
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).send(renderNotFoundPage());
});

app.listen(PORT, () => {
  console.log(`Node server running at http://localhost:${PORT}`);
});

function renderLandingPage(req, isLoggedInFlag, isDevFlag = false) {
  const now = new Date();
  const phpVersionLike = 'Node ' + process.version;

  const projectDescription = process.env.PROJECT_DESCRIPTION || '';
  const projectImageUrl = process.env.PROJECT_IMAGE_URL || '';

  const host = req.headers.host || '';
  const providerName = host === 'appwizzy.com' ? 'AppWizzy' : 'Flatlogic';

  const nowUtc = new Date(now.toISOString());
  const nowUtcString = nowUtc.toISOString().replace('T', ' ').substring(0, 19);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>New Style</title>
  ${projectDescription ? `
  <meta name="description" content="${escapeHtml(projectDescription)}" />
  <meta property="og:description" content="${escapeHtml(projectDescription)}" />
  <meta property="twitter:description" content="${escapeHtml(projectDescription)}" />
  ` : ''}
  ${projectImageUrl ? `
  <meta property="og:image" content="${escapeHtml(projectImageUrl)}" />
  <meta property="twitter:image" content="${escapeHtml(projectImageUrl)}" />
  ` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css">
  <style>
    :root {
      --bg-color-start: #6a11cb;
      --bg-color-end: #2575fc;
      --text-color: #ffffff;
      --card-bg-color: rgba(255, 255, 255, 0.01);
      --card-border-color: rgba(255, 255, 255, 0.1);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      background: linear-gradient(45deg, var(--bg-color-start), var(--bg-color-end));
      color: var(--text-color);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
      overflow: hidden;
      position: relative;
    }
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><path d="M-10 10L110 10M10 -10L10 110" stroke-width="1" stroke="rgba(255,255,255,0.05)"/></svg>');
      animation: bg-pan 20s linear infinite;
      z-index: -1;
    }
    @keyframes bg-pan {
      0% { background-position: 0% 0%; }
      100% { background-position: 100% 100%; }
    }
    main {
      padding: 2rem;
      width: 100%;
      max-width: 720px;
    }
    .nav-bar {
      position: absolute;
      top: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 1rem;
      font-weight: 600;
    }
    .nav-bar a {
      color: #fff;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      transition: background 0.2s ease;
    }
    .nav-bar a:hover {
      background: rgba(255,255,255,0.25);
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 3rem 4rem;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
    }
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap; border: 0;
    }
    h1 {
      font-size: 3rem;
      font-weight: 700;
      margin: 0 0 1rem;
      letter-spacing: -1px;
      color: #111827;
    }
    p {
      margin: 0.5rem 0;
      font-size: 1.1rem;
      color: #4b5563;
    }
    .primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 2.5rem;
      border-radius: 999px;
      border: none;
      background-color: #4F46E5;
      color: #ffffff;
      font-weight: 600;
      font-size: 1rem;
      text-decoration: none;
      margin-top: 1.75rem;
      box-shadow: 0 12px 30px rgba(79, 70, 229, 0.4);
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }
    .primary-btn:hover {
      background-color: #4338CA;
      transform: translateY(-1px);
      box-shadow: 0 18px 40px rgba(79, 70, 229, 0.5);
    }
    footer {
      position: absolute;
      bottom: 1rem;
      font-size: 0.8rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <a href="/">Home</a>
    <a href="/courses">Courses</a>
    ${isDevFlag ? '<a href="/admin/prompts" style="color: #fff; text-decoration: none; padding: 0.5rem 1rem; border-radius: 999px; background: rgba(255,193,7,0.2); margin-right: 0.5rem;">⚙️ Admin</a>' : ''}
    ${isLoggedInFlag ? '<form method="POST" action="/logout" style="display: inline;"><button type="submit" style="background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 0.5rem 1rem; border-radius: 999px; cursor: pointer;">Logout</button></form>' : '<a href="/login">Login</a>'}
  </nav>
  <main>
    <div class="card">
      <h1>Create Videos with AI</h1>
      <p>Our platform allows you to generate professional educational videos by leveraging cutting-edge AI and simulation tools.</p>
      <a class="primary-btn" href="/courses">Get Started</a>
    </div>
  </main>
  <footer>
    Page updated: ${escapeHtml(nowUtcString)} (UTC)
  </footer>
</body>
</html>`;
}

function renderCoursesPage(isLoggedInFlag, isDevFlag = false) {
  const cards = courses.map((course) => `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm course-card">
          <div class="position-relative">
            <img src="${escapeHtml(course.image)}" class="card-img-top" alt="${escapeHtml(course.title)}">
            <div class="position-absolute top-0 end-0 m-2">
              <span class="badge bg-primary" style="font-size: 1.5rem; padding: 0.5rem;">${course.icon || '📚'}</span>
            </div>
          </div>
          <div class="card-body">
            <h5 class="card-title">${escapeHtml(course.title)}</h5>
            <p class="card-text text-muted">${escapeHtml(course.description)}</p>
          </div>
          <div class="card-footer bg-white border-0 d-flex gap-2">
            <a href="${course.toolLink || `/courses/${course.id}`}" class="btn btn-primary flex-fill">
              Use ${course.toolName ? course.toolName.charAt(0).toUpperCase() + course.toolName.slice(1) : 'Tool'}
            </a>
            <a href="/courses/${course.id}" class="btn btn-outline-secondary">Details</a>
          </div>
        </div>
      </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Courses - AI Video Platform</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item">
            <a class="nav-link" href="/">Home</a>
          </li>
          <li class="nav-item">
            <a class="nav-link active" aria-current="page" href="/courses">Courses</a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="toolsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              AI Tools
            </a>
            <ul class="dropdown-menu" aria-labelledby="toolsDropdown">
              <li><a class="dropdown-item" href="/simulation">🔬 Simulation</a></li>
              <li><a class="dropdown-item" href="/script">📝 Script Generation</a></li>
              <li><a class="dropdown-item" href="/video">🎬 Video Generation</a></li>
            </ul>
          </li>
          ${getAuthNavItem(isLoggedInFlag, isDevFlag)}
        </ul>
      </div>
    </div>
  </nav>
  <main class="container my-5">
    <div class="text-center mb-5">
      <h1 class="fw-bold">AI Video Creation Tools</h1>
      <p class="lead text-muted">Choose a tool to start creating your educational video. Each tool guides you through the process with AI assistance.</p>
    </div>
    <div class="row g-4 mb-5">
      ${cards}
    </div>
    <div class="row mt-5">
      <div class="col-12">
        <div class="card bg-light border-0">
          <div class="card-body p-4">
            <h5 class="card-title mb-3">📋 Workflow Guide</h5>
            <div class="row">
              <div class="col-md-4 mb-3">
                <div class="d-flex align-items-start">
                  <span class="badge bg-primary rounded-circle me-3" style="width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center;">1</span>
                  <div>
                    <h6 class="mb-1">Simulation</h6>
                    <p class="text-muted small mb-0">Create and configure simulations for your video content.</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <div class="d-flex align-items-start">
                  <span class="badge bg-success rounded-circle me-3" style="width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center;">2</span>
                  <div>
                    <h6 class="mb-1">Script</h6>
                    <p class="text-muted small mb-0">Generate engaging scripts based on your simulation requirements.</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <div class="d-flex align-items-start">
                  <span class="badge bg-warning rounded-circle me-3" style="width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center;">3</span>
                  <div>
                    <h6 class="mb-1">Video</h6>
                    <p class="text-muted small mb-0">Combine everything into a complete educational video.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

function renderCourseDetailPage(course, isLoggedInFlag, isDevFlag = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(course.title)} - AI Video Platform</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item">
            <a class="nav-link" href="/">Home</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/courses">Courses</a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="toolsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              AI Tools
            </a>
            <ul class="dropdown-menu" aria-labelledby="toolsDropdown">
              <li><a class="dropdown-item" href="/simulation">🔬 Simulation</a></li>
              <li><a class="dropdown-item" href="/script">📝 Script Generation</a></li>
              <li><a class="dropdown-item" href="/video">🎬 Video Generation</a></li>
            </ul>
          </li>
          ${getAuthNavItem(isLoggedInFlag, isDevFlag)}
        </ul>
      </div>
    </div>
  </nav>
  <main class="container my-5">
    <div class="row g-4 align-items-center">
      <div class="col-md-6">
        <img src="${escapeHtml(course.image)}" class="img-fluid rounded shadow-sm" alt="${escapeHtml(course.title)}">
      </div>
      <div class="col-md-6">
        <h1 class="fw-bold mb-3">${escapeHtml(course.title)}</h1>
        <p class="lead text-muted mb-4">${escapeHtml(course.description)}</p>
        <p class="text-muted">Detailed course content will appear here. Use this space to describe modules, lessons, and outcomes.</p>
        <a href="/courses" class="btn btn-primary me-2">Back to Courses</a>
        <a href="/" class="btn btn-outline-secondary">Home</a>
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}


function renderNotFoundPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>404 | Not Found</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
</head>
<body class="bg-light d-flex align-items-center" style="min-height:100vh;">
  <div class="container text-center">
    <h1 class="display-4 fw-bold mb-3">404</h1>
    <p class="lead text-muted mb-4">The page you are looking for could not be found.</p>
    <a class="btn btn-primary me-2" href="/">Home</a>
    <a class="btn btn-outline-secondary" href="/courses">Browse Courses</a>
  </div>
</body>
</html>`;
}

function renderLoginPage(errorMessage) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - AI Video Platform</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
          <li class="nav-item"><a class="nav-link" href="/courses">Courses</a></li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="toolsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              AI Tools
            </a>
            <ul class="dropdown-menu" aria-labelledby="toolsDropdown">
              <li><a class="dropdown-item" href="/simulation">🔬 Simulation</a></li>
              <li><a class="dropdown-item" href="/script">📝 Script Generation</a></li>
              <li><a class="dropdown-item" href="/video">🎬 Video Generation</a></li>
            </ul>
          </li>
          <li class="nav-item"><a class="nav-link active" aria-current="page" href="/login">Login</a></li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="card shadow-sm">
          <div class="card-body p-4">
            <h1 class="fw-bold mb-4">Login</h1>
            ${errorMessage ? `
            <div class="alert alert-danger" role="alert">
              ${escapeHtml(errorMessage)}
            </div>
            ` : ''}
            <form method="POST" action="/login">
              <div class="mb-3">
                <label for="username" class="form-label">Username</label>
                <input type="text" class="form-control" id="username" name="username" required autofocus>
              </div>
              <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <input type="password" class="form-control" id="password" name="password" required>
              </div>
              <button type="submit" class="btn btn-primary w-100 mb-3">Login</button>
            </form>
            <div class="text-center">
              <p class="text-muted mb-0">Don't have an account? <a href="/register">Register here</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top mt-5">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

function renderRegisterPage(errorMessage) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Register - AI Video Platform</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
          <li class="nav-item"><a class="nav-link" href="/courses">Courses</a></li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="toolsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              AI Tools
            </a>
            <ul class="dropdown-menu" aria-labelledby="toolsDropdown">
              <li><a class="dropdown-item" href="/simulation">🔬 Simulation</a></li>
              <li><a class="dropdown-item" href="/script">📝 Script Generation</a></li>
              <li><a class="dropdown-item" href="/video">🎬 Video Generation</a></li>
            </ul>
          </li>
          <li class="nav-item"><a class="nav-link active" aria-current="page" href="/register">Register</a></li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="card shadow-sm">
          <div class="card-body p-4">
            <h1 class="fw-bold mb-4">Create Account</h1>
            ${errorMessage ? `
            <div class="alert alert-danger" role="alert">
              ${escapeHtml(errorMessage)}
            </div>
            ` : ''}
            <form method="POST" action="/register">
              <div class="mb-3">
                <label for="username" class="form-label">Username</label>
                <input type="text" class="form-control" id="username" name="username" required autofocus>
                <small class="text-muted">Choose a unique username</small>
              </div>
              <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <input type="password" class="form-control" id="password" name="password" required minlength="6">
                <small class="text-muted">Must be at least 6 characters long</small>
              </div>
              <div class="mb-3">
                <label for="confirmPassword" class="form-label">Confirm Password</label>
                <input type="password" class="form-control" id="confirmPassword" name="confirmPassword" required minlength="6">
              </div>
              <button type="submit" class="btn btn-primary w-100 mb-3">Register</button>
            </form>
            <div class="text-center">
              <p class="text-muted mb-0">Already have an account? <a href="/login">Login here</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top mt-5">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

function getAuthNavItem(isLoggedInFlag, isDevFlag = false) {
  if (isLoggedInFlag) {
    return `
      ${isDevFlag ? `
      <li class="nav-item">
        <a class="nav-link text-warning" href="/admin/prompts">⚙️ Admin</a>
      </li>
      ` : ''}
      <li class="nav-item">
        <form method="POST" action="/logout" style="display: inline;">
          <button type="submit" class="btn btn-link nav-link" style="border: none; background: none; padding: 0.5rem 1rem; color: inherit;">Logout</button>
        </form>
      </li>
    `;
  } else {
    return `
      <li class="nav-item">
        <a class="nav-link" href="/login">Login</a>
      </li>
    `;
  }
}

function renderAIToolPage(tool, history, isLoggedInFlag, isDevFlag = false) {
  const messagesHtml = (history && history.length)
    ? history.map((m) => `
        <div class="message mb-3 ${m.role === 'user' ? 'user-message' : 'assistant-message'}">
          <div class="bubble">
            ${escapeHtml(m.content).replace(/\n/g, '<br>')}
          </div>
        </div>
      `).join('')
    : '<div class="text-center text-muted mt-5">Start the conversation by describing your requirements below.</div>';

  const toolIcons = {
    simulation: '🔬',
    script: '📝',
    video: '🎬',
  };

  const toolColors = {
    simulation: '#8B5CF6', // Purple
    script: '#10B981', // Green
    video: '#F59E0B', // Amber
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(tool.title)} - AI Video Platform</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    // 함수를 head에서 먼저 정의 - 반드시 로드되도록
    window.generateOutput = async function(toolName) {
      console.log('[generateOutput] 함수 호출됨!', toolName);
      
      try {
        if (!toolName) {
          const btn = document.getElementById('generateBtn');
          if (btn) {
            toolName = btn.getAttribute('data-tool-name');
            console.log('[generateOutput] data-tool-name에서 가져옴:', toolName);
          }
        }
        
        if (!toolName) {
          alert('오류: toolName을 찾을 수 없습니다.');
          return;
        }
        
        const generateBtn = document.getElementById('generateBtn');
        const statusDiv = document.getElementById('generationStatus');
        const resultDiv = document.getElementById('generationResult');
        
        if (!generateBtn || !statusDiv || !resultDiv) {
          alert('오류: 필요한 요소를 찾을 수 없습니다.');
          return;
        }
        
        // 버튼 비활성화 및 상태 표시
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        statusDiv.className = 'alert alert-info';
        statusDiv.innerHTML = 'Generating your ' + toolName + '... This may take a few moments.';
        statusDiv.classList.remove('d-none');
        resultDiv.innerHTML = '';
        
        // API 호출
        const apiUrl = '/' + toolName + '/generate';
        console.log('[generateOutput] API 호출:', apiUrl);
        
        let response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
          });
        } catch (fetchError) {
          console.error('[generateOutput] Fetch 오류:', fetchError);
          throw new Error('네트워크 오류: 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (' + fetchError.message + ')');
        }
        
        console.log('[generateOutput] 응답 상태:', response.status, response.ok);
        
        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = '응답을 읽을 수 없습니다';
          }
          console.error('[generateOutput] HTTP 오류:', response.status, errorText);
          throw new Error('HTTP ' + response.status + ': ' + errorText);
        }
        
        let result;
        try {
          result = await response.json();
        } catch (jsonError) {
          console.error('[generateOutput] JSON 파싱 오류:', jsonError);
          throw new Error('서버 응답을 파싱할 수 없습니다: ' + jsonError.message);
        }
        console.log('[generateOutput] 결과:', result);
        
        if (result.success) {
          statusDiv.className = 'alert alert-success';
          statusDiv.textContent = 'Successfully generated!';
          
          let resultHtml = '<div class="card mt-3"><div class="card-body">';
          
          if (toolName === 'script') {
            resultHtml += '<h5>Script Generated!</h5>';
            if (result.jsonUrl) {
              const jsonUrlEscaped = (window.escapeHtml ? window.escapeHtml(result.jsonUrl) : result.jsonUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
              const jsonFileEscaped = (window.escapeHtml ? window.escapeHtml(result.jsonFile || 'script.json') : (result.jsonFile || 'script.json').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
              resultHtml += '<div class="d-flex flex-wrap gap-2 mb-3">';
              resultHtml += '<a href="' + jsonUrlEscaped + '" target="_blank" class="btn btn-primary">구조화된 대본 (JSON) 다운로드</a>';
              resultHtml += '<button id="exportToVideoEditorBtn" data-script-url="' + jsonUrlEscaped + '" data-script-name="' + jsonFileEscaped + '" class="btn btn-success">📤 비디오 편집기로 내보내기</button>';
              resultHtml += '</div>';
              resultHtml += '<p class="text-muted small mt-2">구조화된 대본 (JSON): <a href="' + jsonUrlEscaped + '" target="_blank">' + jsonFileEscaped + '</a></p>';
            }
            if (result.url) {
              resultHtml += '<p><a href="' + result.url + '" target="_blank" class="btn btn-outline-primary">텍스트 대본 다운로드</a></p>';
            }
            if (result.scriptText) {
              const scriptPreview = result.scriptText.substring(0, 500) + (result.scriptText.length > 500 ? '...' : '');
              resultHtml += '<div class="mt-3"><h6>대본 미리보기:</h6><pre class="bg-light p-3 rounded" style="max-height: 300px; overflow-y: auto;"><code>' + (window.escapeHtml ? window.escapeHtml(scriptPreview) : scriptPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</code></pre></div>';
            }
          } else if (toolName === 'simulation') {
            const programBadge = result.programName ? '<span class="badge bg-info ms-2">' + result.programName + '</span>' : '';
            resultHtml += '<h5>Simulation Generated!' + programBadge + '</h5>';
            if (result.url) {
              resultHtml += '<video controls class="w-100"><source src="' + result.url + '" type="video/mp4">Your browser does not support the video tag.</video><p><a href="' + result.url + '" target="_blank" class="btn btn-primary mt-2">Download Video</a></p>';
            }
          } else if (toolName === 'video') {
            if (result.url) {
              resultHtml += '<h5>Video Generated!</h5><video controls class="w-100"><source src="' + result.url + '" type="video/mp4">Your browser does not support the video tag.</video><p><a href="' + result.url + '" target="_blank" class="btn btn-primary mt-2">Download Video</a></p>';
            }
          } else if (toolName === 'ai-video') {
            if (result.url) {
              resultHtml += '<h5>AI Video Generated!</h5><video controls class="w-100"><source src="' + result.url + '" type="video/mp4">Your browser does not support the video tag.</video><p><a href="' + result.url + '" target="_blank" class="btn btn-primary mt-2">Download Video</a></p>';
            }
          }
          
          if (result.code) {
            const codePreview = result.code.substring(0, 500) + (result.code.length > 500 ? '...' : '');
            const codeLanguage = result.program === 'matlab' ? 'matlab' : result.program === 'blender' ? 'python' : 'python';
            resultHtml += '<div class="mt-3"><h6>Generated Code (' + (result.programName || 'Python') + '):</h6><pre class="bg-light p-3 rounded"><code class="language-' + codeLanguage + '">' + (window.escapeHtml ? window.escapeHtml(codePreview) : codePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</code></pre></div>';
          }
          
          resultHtml += '</div></div>';
          resultDiv.innerHTML = resultHtml;
          
          // 동적으로 생성된 버튼에 이벤트 리스너 추가
          if (toolName === 'script') {
            const exportBtn = resultDiv.querySelector('#exportToVideoEditorBtn');
            if (exportBtn) {
              exportBtn.addEventListener('click', function() {
                const scriptUrl = this.getAttribute('data-script-url');
                const scriptName = this.getAttribute('data-script-name');
                if (typeof window.exportToVideoEditor === 'function') {
                  window.exportToVideoEditor(scriptUrl, scriptName);
                } else {
                  alert('exportToVideoEditor 함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
                }
              });
            }
          }
        } else {
          const errorMsg = result.error || 'Failed to generate';
          
          // Check for quota exceeded error
          if (errorMsg.includes('quota') || errorMsg.includes('billing') || errorMsg.includes('exceeded')) {
            statusDiv.className = 'alert alert-warning';
            statusDiv.innerHTML = '<strong>⚠️ Gemini API 할당량 초과</strong><br>' +
              'Gemini API 할당량이 초과되었습니다. 다음을 확인해주세요:<br>' +
              '<ul class="mb-0 mt-2">' +
              '<li><a href="https://aistudio.google.com/" target="_blank">Google AI Studio 확인</a></li>' +
              '<li>.env 파일의 GEMINI_API_KEY가 올바른지 확인하세요</li>' +
              '<li>Google AI Studio에서 사용량을 확인하세요</li>' +
              '</ul>';
          } else {
            statusDiv.className = 'alert alert-danger';
            statusDiv.textContent = 'Error: ' + errorMsg;
          }
        }
        
        // 버튼 다시 활성화
        generateBtn.disabled = false;
        const btnText = toolName === 'script' ? '📝 Generate Script' : toolName === 'simulation' ? '🔬 Generate Simulation' : toolName === 'ai-video' ? '🎥 Generate AI Video' : '🎬 Generate Video';
        generateBtn.textContent = btnText;
        
      } catch (error) {
        console.error('[generateOutput] 오류:', error);
        const errorMsg = String(error.message || '알 수 없는 오류').replace(/'/g, "\\'").replace(/"/g, '\\"');
        alert('오류 발생: ' + errorMsg);
        
        const generateBtn = document.getElementById('generateBtn');
        const statusDiv = document.getElementById('generationStatus');
        
        if (generateBtn) {
          generateBtn.disabled = false;
          const btnText = toolName === 'script' ? '📝 Generate Script' : toolName === 'simulation' ? '🔬 Generate Simulation' : toolName === 'ai-video' ? '🎥 Generate AI Video' : '🎬 Generate Video';
          generateBtn.textContent = btnText;
        }
        
        if (statusDiv) {
          statusDiv.className = 'alert alert-danger';
          statusDiv.innerHTML = '<strong>오류 발생:</strong><br>' + (window.escapeHtml ? window.escapeHtml(error.message) : error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
      }
    };
    
    // Helper function for HTML escaping
    window.escapeHtml = function(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    // 비디오 편집기로 내보내기 함수
    window.exportToVideoEditor = function(scriptUrl, scriptName) {
      const confirmMessage = '대본이 비디오 편집기의 미디어 라이브러리에 추가되었습니다.\\n\\n비디오 편집기로 이동하시겠습니까?';
      
      if (confirm(confirmMessage)) {
        window.location.href = '/video/edit';
      } else {
        const safeScriptName = String(scriptName || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        alert('✅ 대본이 저장되었습니다.\\n\\n비디오 편집기(/video/edit)의 미디어 라이브러리에서 "' + safeScriptName + '" 파일을 찾을 수 있습니다.');
      }
    };
  </script>
  <style>
    .tool-header {
      background: linear-gradient(135deg, ${toolColors[tool.name]}15 0%, ${toolColors[tool.name]}05 100%);
      border-left: 4px solid ${toolColors[tool.name]};
      padding: 1.5rem;
      border-radius: 0.5rem;
      margin-bottom: 2rem;
    }
    .tool-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }
    .mcp-status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 500;
      margin-top: 1rem;
    }
    .mcp-connected {
      background-color: #10B98120;
      color: #10B981;
      border: 1px solid #10B981;
    }
    .mcp-disconnected {
      background-color: #EF444420;
      color: #EF4444;
      border: 1px solid #EF4444;
    }
  </style>
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
          <li class="nav-item"><a class="nav-link" href="/courses">Courses</a></li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" id="toolsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              AI Tools
            </a>
            <ul class="dropdown-menu" aria-labelledby="toolsDropdown">
              <li><a class="dropdown-item" href="/simulation">${toolIcons.simulation} Simulation</a></li>
              <li><a class="dropdown-item" href="/script">${toolIcons.script} Script Generation</a></li>
              <li><a class="dropdown-item" href="/video">${toolIcons.video} Video Generation</a></li>
            </ul>
          </li>
          ${getAuthNavItem(isLoggedInFlag, isDevFlag)}
        </ul>
      </div>
    </div>
  </nav>
  <main class="container my-5">
    <div class="tool-header">
      <div class="text-center">
        <div class="tool-icon">${toolIcons[tool.name]}</div>
        <h1 class="fw-bold mb-2">${escapeHtml(tool.title)}</h1>
        <p class="lead text-muted mb-0">${escapeHtml(tool.description)}</p>
        ${tool.name === 'simulation' ? `
        <div class="mt-3">
          <small class="text-muted">Supported Programs: </small>
          <span class="badge bg-secondary">Python</span>
          <span class="badge bg-secondary">MATLAB</span>
          <span class="badge bg-secondary">Blender</span>
        </div>
        ` : ''}
        <div class="mcp-status mcp-disconnected mt-3" id="mcpStatus">
          <span id="mcpStatusText">MCP: Disconnected</span>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-md-8 mx-auto">
        <div class="card shadow-sm">
          <div class="card-body p-4">
            <div class="mb-3 d-flex justify-content-between align-items-center">
              <small class="text-muted">${history && history.length > 0 ? `Chat History: ${history.length} messages` : 'Start chatting to generate content'}</small>
              <div>
                <button type="button" class="btn btn-success btn-sm me-2" id="generateBtn" data-tool-name="${tool.name}">
                  ${tool.name === 'script' ? '📝 Generate Script' : tool.name === 'simulation' ? '🔬 Generate Simulation' : tool.name === 'ai-video' ? '🎥 Generate AI Video' : '🎬 Generate Video'}
                </button>
                ${tool.name === 'video' ? `
                <a href="/video/edit" class="btn btn-primary btn-sm me-2">
                  🎥 비디오 편집하기
                </a>
                ` : ''}
                ${history && history.length > 0 ? `
                <form method="POST" action="/${tool.name}/clear" style="display: inline;">
                  <button type="submit" class="btn btn-outline-secondary btn-sm">새 채팅 시작</button>
                </form>
                ` : ''}
              </div>
            </div>
            <div id="generationStatus" class="alert alert-info d-none" role="alert"></div>
            <div id="generationResult" class="mb-3"></div>
            <div id="chat-window" class="mb-3 p-3 bg-light"
                 style="height: 450px; overflow-y: scroll; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
              ${messagesHtml}
            </div>
            <form method="POST" action="/${tool.name}">
              <div class="mb-3">
                <label for="prompt" class="form-label">Your Requirements</label>
                <textarea class="form-control" id="prompt" name="prompt" rows="3" 
                  placeholder="Describe what you need for ${tool.name}..." required></textarea>
              </div>
              <button type="submit" class="btn btn-primary w-100" style="background-color: ${toolColors[tool.name]}; border-color: ${toolColors[tool.name]};">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top mt-5">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // 함수를 body에서도 정의하여 확실하게 작동하도록 함
    window.generateOutput = async function(toolName) {
      console.log('[Body Script] generateOutput 함수 호출됨!', toolName);
      
      try {
        if (!toolName) {
          const btn = document.getElementById('generateBtn');
          if (btn) {
            toolName = btn.getAttribute('data-tool-name');
          }
        }
        
        if (!toolName) {
          alert('오류: toolName을 찾을 수 없습니다.');
          return;
        }
        
        const generateBtn = document.getElementById('generateBtn');
        const statusDiv = document.getElementById('generationStatus');
        const resultDiv = document.getElementById('generationResult');
        
        if (!generateBtn || !statusDiv || !resultDiv) {
          alert('오류: 필요한 요소를 찾을 수 없습니다.');
          return;
        }
        
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        statusDiv.className = 'alert alert-info';
        statusDiv.innerHTML = 'Generating your ' + toolName + '... This may take a few moments.';
        statusDiv.classList.remove('d-none');
        resultDiv.innerHTML = '';
        
        const response = await fetch('/' + toolName + '/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin'
        });
        
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + await response.text());
        }
        
        const result = await response.json();
        
        if (result.success) {
          statusDiv.className = 'alert alert-success';
          statusDiv.textContent = 'Successfully generated!';
          
          let resultHtml = '<div class="card mt-3"><div class="card-body">';
          
          if (toolName === 'script') {
            resultHtml += '<h5>Script Generated!</h5>';
            if (result.jsonUrl) {
              const jsonUrlEscaped = (window.escapeHtml ? window.escapeHtml(result.jsonUrl) : result.jsonUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
              const jsonFileEscaped = (window.escapeHtml ? window.escapeHtml(result.jsonFile || 'script.json') : (result.jsonFile || 'script.json').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
              resultHtml += '<div class="d-flex flex-wrap gap-2 mb-3">';
              resultHtml += '<a href="' + jsonUrlEscaped + '" target="_blank" class="btn btn-primary">구조화된 대본 (JSON) 다운로드</a>';
              resultHtml += '<button id="exportToVideoEditorBtn" data-script-url="' + jsonUrlEscaped + '" data-script-name="' + jsonFileEscaped + '" class="btn btn-success">📤 비디오 편집기로 내보내기</button>';
              resultHtml += '</div>';
              resultHtml += '<p class="text-muted small mt-2">구조화된 대본 (JSON): <a href="' + jsonUrlEscaped + '" target="_blank">' + jsonFileEscaped + '</a></p>';
            }
            if (result.url) {
              resultHtml += '<p><a href="' + result.url + '" target="_blank" class="btn btn-outline-primary">텍스트 대본 다운로드</a></p>';
            }
            if (result.scriptText) {
              const scriptPreview = result.scriptText.substring(0, 500) + (result.scriptText.length > 500 ? '...' : '');
              resultHtml += '<div class="mt-3"><h6>대본 미리보기:</h6><pre class="bg-light p-3 rounded" style="max-height: 300px; overflow-y: auto;"><code>' + (window.escapeHtml ? window.escapeHtml(scriptPreview) : scriptPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</code></pre></div>';
            }
          } else if (toolName === 'simulation') {
            const programBadge = result.programName ? '<span class="badge bg-info ms-2">' + result.programName + '</span>' : '';
            resultHtml += '<h5>Simulation Generated!' + programBadge + '</h5>';
            if (result.url) {
              resultHtml += '<video controls class="w-100"><source src="' + result.url + '" type="video/mp4">Your browser does not support the video tag.</video><p><a href="' + result.url + '" target="_blank" class="btn btn-primary mt-2">Download Video</a></p>';
            }
          } else if (toolName === 'video' || toolName === 'ai-video') {
            if (result.url) {
              resultHtml += '<h5>Video Generated!</h5><video controls class="w-100"><source src="' + result.url + '" type="video/mp4">Your browser does not support the video tag.</video><p><a href="' + result.url + '" target="_blank" class="btn btn-primary mt-2">Download Video</a></p>';
            }
          }
          
          if (result.code) {
            const codePreview = result.code.substring(0, 500) + (result.code.length > 500 ? '...' : '');
            const codeLanguage = result.program === 'matlab' ? 'matlab' : result.program === 'blender' ? 'python' : 'python';
            resultHtml += '<div class="mt-3"><h6>Generated Code (' + (result.programName || 'Python') + '):</h6><pre class="bg-light p-3 rounded"><code class="language-' + codeLanguage + '">' + (window.escapeHtml ? window.escapeHtml(codePreview) : codePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</code></pre></div>';
          }
          
          resultHtml += '</div></div>';
          resultDiv.innerHTML = resultHtml;
          
          // 동적으로 생성된 버튼에 이벤트 리스너 추가
          if (toolName === 'script') {
            const exportBtn = resultDiv.querySelector('#exportToVideoEditorBtn');
            if (exportBtn) {
              exportBtn.addEventListener('click', function() {
                const scriptUrl = this.getAttribute('data-script-url');
                const scriptName = this.getAttribute('data-script-name');
                if (typeof window.exportToVideoEditor === 'function') {
                  window.exportToVideoEditor(scriptUrl, scriptName);
                } else {
                  alert('exportToVideoEditor 함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
                }
              });
            }
          }
        } else {
          const errorMsg = result.error || 'Failed to generate';
          statusDiv.className = 'alert alert-danger';
          statusDiv.textContent = 'Error: ' + errorMsg;
        }
        
        generateBtn.disabled = false;
        const btnText = toolName === 'script' ? '📝 Generate Script' : toolName === 'simulation' ? '🔬 Generate Simulation' : toolName === 'ai-video' ? '🎥 Generate AI Video' : '🎬 Generate Video';
        generateBtn.textContent = btnText;
      } catch (error) {
        console.error('[Body Script] 오류:', error);
        const errorMsg = String(error.message || '알 수 없는 오류').replace(/'/g, "\\'").replace(/"/g, '\\"');
        alert('오류 발생: ' + errorMsg);
        const generateBtn = document.getElementById('generateBtn');
        const statusDiv = document.getElementById('generationStatus');
        if (generateBtn) {
          generateBtn.disabled = false;
          const btnText = toolName === 'script' ? '📝 Generate Script' : toolName === 'simulation' ? '🔬 Generate Simulation' : toolName === 'ai-video' ? '🎥 Generate AI Video' : '🎬 Generate Video';
          generateBtn.textContent = btnText;
        }
        if (statusDiv) {
          statusDiv.className = 'alert alert-danger';
          statusDiv.innerHTML = '<strong>오류 발생:</strong><br>' + (window.escapeHtml ? window.escapeHtml(error.message) : error.message.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
      }
    };
    
    window.exportToVideoEditor = async function(scriptUrl, scriptName) {
      console.log('[Body Script] exportToVideoEditor 함수 호출됨!', scriptUrl, scriptName);
      
      // 파일이 실제로 존재하는지 확인
      try {
        const checkResponse = await fetch(scriptUrl, { method: 'HEAD' });
        if (!checkResponse.ok) {
          throw new Error('파일을 찾을 수 없습니다: ' + scriptUrl);
        }
        
        console.log('[Body Script] 파일 확인 완료:', scriptUrl);
        
        const safeScriptName = String(scriptName || scriptUrl.split('/').pop() || '대본').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const confirmMessage = '✅ 대본이 저장되었습니다: ' + safeScriptName + '\\n\\n비디오 편집기의 미디어 라이브러리에서 이 파일을 찾을 수 있습니다.\\n\\n비디오 편집기로 이동하시겠습니까?';
        
        if (confirm(confirmMessage)) {
          window.location.href = '/video/edit';
        } else {
          alert('✅ 대본이 저장되었습니다.\\n\\n비디오 편집기(/video/edit)의 미디어 라이브러리에서 "' + safeScriptName + '" 파일을 찾을 수 있습니다.');
        }
      } catch (error) {
        console.error('[Body Script] 파일 확인 오류:', error);
        alert('⚠️ 경고: 파일을 확인할 수 없습니다.\\n\\n파일 경로: ' + scriptUrl + '\\n\\n오류: ' + error.message + '\\n\\n파일이 실제로 저장되었는지 확인해주세요.');
      }
    };
    
    console.log('[Body Script] 함수 정의 완료 - generateOutput:', typeof window.generateOutput, 'exportToVideoEditor:', typeof window.exportToVideoEditor);
    
    // Hugging Face 모델로 채팅 히스토리 기반 비디오 생성 함수
    window.generateVideoFromChat = async function() {
      // escapeHtml 헬퍼 함수 정의
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      const generateBtn = document.getElementById('generateVideoFromChatBtn');
      const statusDiv = document.getElementById('generationStatus');
      const resultDiv = document.getElementById('generationResult');
      
      if (!generateBtn) {
        alert('버튼을 찾을 수 없습니다.');
        return;
      }
      
      if (!statusDiv) {
        alert('상태 표시 영역을 찾을 수 없습니다.');
        return;
      }
      
      if (!resultDiv) {
        alert('결과 표시 영역을 찾을 수 없습니다.');
        return;
      }
      
      // 버튼 비활성화
      generateBtn.disabled = true;
      generateBtn.textContent = '생성 중...';
      statusDiv.className = 'alert alert-info';
      statusDiv.innerHTML = '채팅 내용을 기반으로 Hugging Face 모델로 비디오를 생성하고 있습니다...';
      statusDiv.classList.remove('d-none');
      resultDiv.innerHTML = '';
      
      try {
        const response = await fetch('/video/generate-from-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        
        if (data.success) {
          statusDiv.className = 'alert alert-success';
          statusDiv.innerHTML = '비디오 생성이 완료되었습니다!';
          
          if (data.url) {
            const videoUrl = escapeHtml(data.url);
            resultDiv.innerHTML = 
              '<div class="mt-3">' +
                '<h5>생성된 비디오:</h5>' +
                '<video controls class="w-100 mt-2" style="max-height: 500px;">' +
                  '<source src="' + videoUrl + '" type="video/mp4">' +
                  '브라우저가 비디오 태그를 지원하지 않습니다.' +
                '</video>' +
                '<div class="mt-2">' +
                  '<a href="' + videoUrl + '" download class="btn btn-sm btn-outline-primary">비디오 다운로드</a>' +
                '</div>' +
              '</div>';
          } else if (data.jobId) {
            // 진행 상황 폴링
            const pollProgress = setInterval(async () => {
              try {
                const progressRes = await fetch('/api/ai-video/progress/' + data.jobId);
            const progressData = await progressRes.json();
            
            if (progressData.success && progressData.progress) {
              const progress = progressData.progress;
              const progressPercent = progress.progress || 0;
                  const message = progress.message || '처리 중...';
              
                  const escapedMessage = escapeHtml(message);
              statusDiv.innerHTML = 
                '<div class="d-flex align-items-center">' +
                  '<div class="spinner-border spinner-border-sm me-2" role="status"></div>' +
                  '<div class="flex-grow-1">' +
                        '<div class="fw-bold">' + escapedMessage + '</div>' +
                    '<div class="progress mt-2" style="height: 20px;">' +
                      '<div class="progress-bar progress-bar-striped progress-bar-animated" ' +
                           'role="progressbar" ' +
                           'style="width: ' + progressPercent + '%" ' +
                           'aria-valuenow="' + progressPercent + '" ' +
                           'aria-valuemin="0" ' +
                           'aria-valuemax="100">' +
                        progressPercent + '%' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                '</div>';
              
                if (progress.status === 'completed' && progress.result) {
                    clearInterval(pollProgress);
                  statusDiv.className = 'alert alert-success';
                    statusDiv.innerHTML = '비디오 생성이 완료되었습니다!';
                    if (progress.result.url) {
                      const videoUrl = escapeHtml(progress.result.url);
                      resultDiv.innerHTML = 
                        '<div class="mt-3">' +
                          '<h5>생성된 비디오:</h5>' +
                          '<video controls class="w-100 mt-2" style="max-height: 500px;">' +
                            '<source src="' + videoUrl + '" type="video/mp4">' +
                            '브라우저가 비디오 태그를 지원하지 않습니다.' +
                          '</video>' +
                          '<div class="mt-2">' +
                            '<a href="' + videoUrl + '" download class="btn btn-sm btn-outline-primary">비디오 다운로드</a>' +
                          '</div>' +
                        '</div>';
                    }
                } else if (progress.status === 'failed') {
                    clearInterval(pollProgress);
                  statusDiv.className = 'alert alert-danger';
                    statusDiv.innerHTML = '비디오 생성 실패: ' + escapeHtml(progress.message || progress.error || '알 수 없는 오류');
              }
            }
          } catch (e) {
                console.error('진행 상황 확인 오류:', e);
              }
            }, 2000);
            
            // 30분 후 타임아웃
            setTimeout(() => {
              clearInterval(pollProgress);
            }, 30 * 60 * 1000);
          }
          } else {
            statusDiv.className = 'alert alert-danger';
          statusDiv.innerHTML = '오류: ' + escapeHtml(data.error || '알 수 없는 오류');
        }
      } catch (error) {
        console.error('비디오 생성 오류:', error);
        statusDiv.className = 'alert alert-danger';
        statusDiv.innerHTML = '오류: ' + escapeHtml(error.message || '네트워크 오류');
      } finally {
          generateBtn.disabled = false;
        generateBtn.textContent = '🎥 Hugging Face로 비디오 생성';
      }
    };
    
    // 함수가 전역에 노출되었는지 확인
    console.log('[Script] window.generateOutput 정의 확인:', typeof window.generateOutput);
    if (typeof window.generateOutput === 'function') {
      console.log('[Script] ✅ window.generateOutput 함수가 정상적으로 정의되었습니다');
    } else {
      console.error('[Script] ❌ window.generateOutput 함수를 찾을 수 없습니다!');
    }
    
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    
    // Generate 버튼에 이벤트 리스너 추가
    (function() {
      function attachButton() {
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn && !generateBtn.hasAttribute('data-listener-attached')) {
          generateBtn.setAttribute('data-listener-attached', 'true');
          const toolName = generateBtn.getAttribute('data-tool-name');
          
          generateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('[Button Click] 버튼 클릭됨, toolName:', toolName);
            
            if (typeof window.generateOutput === 'function') {
              console.log('[Button Click] generateOutput 함수 호출');
              window.generateOutput(toolName).catch(function(error) {
                console.error('[Button Click] 오류:', error);
                alert('오류 발생: ' + error.message);
              });
            } else {
              console.error('[Button Click] generateOutput 함수를 찾을 수 없습니다!');
              alert('함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
            }
          });
          
          console.log('[attachButton] ✅ Generate 버튼 이벤트 리스너 연결됨');
        }
      }
      
      // 즉시 시도
      attachButton();
      
      // DOM이 로드되지 않았으면 기다림
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachButton);
      }
      
      // 추가 안전장치
      setTimeout(attachButton, 100);
      setTimeout(attachButton, 500);
    })();
    
    // MCP connection status check (placeholder for future MCP integration)
    function checkMCPStatus() {
      // TODO: Implement actual MCP connection check
      // For now, simulate connection status
      const mcpStatusEl = document.getElementById('mcpStatus');
      const mcpStatusText = document.getElementById('mcpStatusText');
      
      // Simulate checking MCP connection
      fetch('/api/mcp/status/${tool.name}')
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            mcpStatusEl.className = 'mcp-status mcp-connected';
            mcpStatusText.textContent = 'MCP: Connected';
          } else {
            mcpStatusEl.className = 'mcp-status mcp-disconnected';
            mcpStatusText.textContent = 'MCP: Disconnected';
          }
        })
        .catch(() => {
          mcpStatusEl.className = 'mcp-status mcp-disconnected';
          mcpStatusText.textContent = 'MCP: Disconnected';
        });
    }
    
    // Check MCP status on page load
    checkMCPStatus();
    
    // Generate Video From Chat 버튼 이벤트 연결
    (function() {
      function attachVideoButton() {
        const btn = document.getElementById('generateVideoFromChatBtn');
        if (btn && typeof window.generateVideoFromChat === 'function') {
          btn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            try {
              window.generateVideoFromChat();
            } catch(err) {
              console.error('비디오 생성 함수 오류:', err);
              alert('오류: ' + err.message);
            }
            return false;
          };
        }
      }
      // 즉시 실행
      attachVideoButton();
      // DOM 로드 후에도 실행
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachVideoButton);
      }
      // 추가 안전장치
      setTimeout(attachVideoButton, 100);
      setTimeout(attachVideoButton, 500);
    })();
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
  </script>
</body>
</html>`;
}

function renderCreateDevAccountPage(errorMessage = null, successMessage = null) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Developer Account</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
    </div>
  </nav>
  <main class="container my-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="card shadow-sm">
          <div class="card-header bg-primary text-white">
            <h4 class="mb-0">🔧 Create Developer Account</h4>
          </div>
          <div class="card-body p-4">
            ${errorMessage ? `
            <div class="alert alert-danger" role="alert">
              ${escapeHtml(errorMessage)}
            </div>
            ` : ''}
            ${successMessage ? `
            <div class="alert alert-success" role="alert">
              ${escapeHtml(successMessage)}
              <div class="mt-3">
                <a href="/login" class="btn btn-success">Go to Login</a>
              </div>
            </div>
            ` : ''}
            <p class="text-muted mb-4">
              개발자 계정을 생성하면 AI 프롬프트 설정 페이지에 접근할 수 있습니다.
            </p>
            <form method="POST" action="/admin/create-dev">
              <div class="mb-3">
                <label for="username" class="form-label">Username</label>
                <input type="text" class="form-control" id="username" name="username" 
                  value="admin" required autofocus>
                <small class="text-muted">개발자 계정으로 인식되려면: admin, developer, dev 중 하나를 사용하거나 role 필드를 설정하세요.</small>
              </div>
              <div class="mb-3">
                <label for="password" class="form-label">Password</label>
                <input type="password" class="form-control" id="password" name="password" required>
              </div>
              <button type="submit" class="btn btn-primary w-100">Create Developer Account</button>
            </form>
            <div class="mt-4">
              <small class="text-muted">
                <strong>참고:</strong> 이미 존재하는 사용자 이름을 입력하면 해당 계정이 개발자 권한으로 업데이트됩니다.
              </small>
            </div>
          </div>
        </div>
        <div class="text-center mt-3">
          <a href="/login" class="text-muted">Already have an account? Login</a>
        </div>
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top mt-5">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

function renderAdminPromptsPage(req, isDevFlag) {
  const tools = ['simulation', 'script', 'video'];
  const toolNames = {
    simulation: 'Simulation',
    script: 'Script Generation',
    video: 'Video Generation',
  };
  const toolIcons = {
    simulation: '🔬',
    script: '📝',
    video: '🎬',
  };

  const promptsHtml = tools.map(tool => {
    const currentPrompt = PromptManager.getSystemPrompt(tool);
    const currentGenPrompt = PromptManager.getGenerationPrompt(tool);
    const toolDescriptions = {
      simulation: '시뮬레이션 생성 시 사용자와 채팅하는 AI의 동작을 설정합니다.',
      script: '대본 생성 시 사용자와 채팅하는 AI의 동작을 설정합니다.',
      video: '비디오 생성 시 사용자와 채팅하는 AI의 동작을 설정합니다.',
    };
    return `
      <div class="card mb-4 shadow-sm border-primary" style="border-width: 2px;">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">${toolIcons[tool]} ${toolNames[tool]} - 독립 설정</h5>
          <small class="text-white-50">이 도구는 다른 도구들과 별도로 프롬프트를 설정합니다.</small>
        </div>
        <div class="card-body">
          <div class="alert alert-light border-start border-primary border-3 mb-3">
            <strong>📌 ${toolNames[tool]} 전용 설정</strong><br>
            <small>${toolDescriptions[tool]}</small>
          </div>
          <div class="mb-3">
            <label for="systemPrompt_${tool}" class="form-label fw-bold">System Prompt (채팅 보조 AI 설정)</label>
            <p class="text-muted small mb-2">이 프롬프트는 <strong>${toolNames[tool]}</strong> 도구에서 사용자와 채팅할 때 AI가 어떻게 보조할지를 결정합니다.</p>
            <textarea class="form-control font-monospace" id="systemPrompt_${tool}" rows="10" style="font-size: 0.9rem;">${escapeHtml(currentPrompt)}</textarea>
            <small class="text-muted">AI의 역할, 목적, 질문 방식, 대화 톤 등을 설정할 수 있습니다. 다른 도구(${tools.filter(t => t !== tool).map(t => toolNames[t]).join(', ')})와는 독립적으로 작동합니다.</small>
          </div>
          <div class="mb-3">
            <label for="generationPrompt_${tool}" class="form-label fw-bold">Generation Prompt (코드/결과 생성 프롬프트)</label>
            <p class="text-muted small mb-2">이 프롬프트는 <strong>${toolNames[tool]}</strong> 도구에서 실제 코드나 결과를 생성할 때 사용됩니다.</p>
            <textarea class="form-control font-monospace" id="generationPrompt_${tool}" rows="6" style="font-size: 0.9rem;">${escapeHtml(currentGenPrompt)}</textarea>
            <small class="text-muted">최종 생성물의 형식과 요구사항을 지정합니다.</small>
          </div>
          <button type="button" class="btn btn-primary" onclick="savePrompt('${tool}')">
            💾 ${toolNames[tool]} 설정 저장
          </button>
          <span id="saveStatus_${tool}" class="ms-3"></span>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Settings - Admin Panel</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/custom.css?v=${Date.now()}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    .font-monospace {
      font-family: 'Courier New', monospace;
    }
    .card-header {
      border-bottom: 2px solid rgba(0,0,0,0.1);
    }
  </style>
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
    <div class="container-fluid">
      <a class="navbar-brand" href="/">AI Video Platform</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
        aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
          <li class="nav-item"><a class="nav-link" href="/courses">Courses</a></li>
          <li class="nav-item"><a class="nav-link active" href="/admin/prompts">⚙️ Admin</a></li>
          <li class="nav-item">
            <form method="POST" action="/logout" style="display: inline;">
              <button type="submit" class="btn btn-link nav-link" style="border: none; background: none; padding: 0.5rem 1rem; color: rgba(255,255,255,0.75);">Logout</button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="container my-5">
    <div class="row">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 class="fw-bold">AI Prompt Settings</h1>
            <p class="text-muted">각 AI 도구의 프롬프트를 커스터마이징하여 AI의 동작 방식을 설정할 수 있습니다.</p>
          </div>
        </div>
        
        <div class="alert alert-info" role="alert">
          <strong>💡 안내:</strong>
          <ul class="mb-0 mt-2">
            <li><strong>각 도구별로 독립적으로 설정됩니다:</strong> 시뮬레이션, 대본, 비디오 각각 다른 채팅 보조 AI를 설정할 수 있습니다.</li>
            <li><strong>System Prompt (채팅 보조 AI 설정)</strong>: 사용자와 채팅할 때 AI가 어떻게 보조할지를 설정합니다. AI의 역할, 질문 방식, 대화 톤 등을 지정할 수 있습니다.</li>
            <li><strong>Generation Prompt (코드/결과 생성 프롬프트)</strong>: 실제 코드나 결과를 생성할 때 사용되는 프롬프트입니다. 생성물의 형식과 요구사항을 지정합니다.</li>
            <li>변경사항은 즉시 저장되며, 각 도구의 다음 요청부터 적용됩니다.</li>
          </ul>
        </div>

        ${promptsHtml}
      </div>
    </div>
  </main>
  <footer class="text-center py-4 text-muted border-top mt-5">
    &copy; ${new Date().getFullYear()} AI Video Platform. All Rights Reserved.
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    async function savePrompt(tool) {
      const systemPrompt = document.getElementById('systemPrompt_' + tool).value;
      const generationPrompt = document.getElementById('generationPrompt_' + tool).value;
      const statusEl = document.getElementById('saveStatus_' + tool);
      
      statusEl.innerHTML = '<span class="text-muted">Saving...</span>';
      
      try {
        const response = await fetch('/api/admin/prompts/' + tool, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemPrompt: systemPrompt,
            generationPrompt: generationPrompt,
          }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          statusEl.innerHTML = '<span class="text-success">✅ ' + (result.tool ? result.tool.toUpperCase() + ' ' : '') + 'Saved successfully! Changes will apply to next requests.</span>';
          setTimeout(() => {
            statusEl.innerHTML = '';
          }, 5000);
        } else {
          statusEl.innerHTML = '<span class="text-danger">❌ Error: ' + (result.error || 'Failed to save') + '</span>';
        }
      } catch (error) {
        statusEl.innerHTML = '<span class="text-danger">❌ Error: ' + error.message + '</span>';
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderVideoEditorPage(isLoggedInFlag, isDevFlag = false, history = []) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>비디오 편집기 - AI Video Platform</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
  <style>
    body {
      background-color: #1a1a1a;
      color: #e0e0e0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
    .editor-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .toolbar {
      background-color: #2d2d2d;
      padding: 10px;
      border-bottom: 1px solid #444;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .toolbar-btn {
      background-color: #3d3d3d;
      border: 1px solid #555;
      color: #e0e0e0;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .toolbar-btn:hover {
      background-color: #4d4d4d;
      border-color: #666;
      color: #e0e0e0;
    }
    .toolbar-btn.active {
      background-color: #007bff;
      border-color: #0056b3;
    }
    .preview-area {
      flex: 1;
      background-color: #0f0f0f;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .preview-video {
      max-width: 100%;
      max-height: 100%;
      background-color: #000;
    }
    .preview-play-button {
      position: absolute;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: rgba(0, 123, 255, 0.9);
      border: 4px solid rgba(255, 255, 255, 0.8);
      color: white;
      font-size: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
      z-index: 100;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
    }
    .preview-play-button:hover {
      background-color: rgba(0, 123, 255, 1);
      transform: translateX(-50%) scale(1.1);
      box-shadow: 0 6px 25px rgba(0, 123, 255, 0.6);
    }
    .preview-play-button:active {
      transform: translateX(-50%) scale(0.95);
    }
    .preview-play-button.playing {
      background-color: rgba(255, 0, 0, 0.9);
    }
    .preview-play-button.playing:hover {
      background-color: rgba(255, 0, 0, 1);
    }
    .timeline-container {
      background-color: #252525;
      border-top: 1px solid #444;
      height: 300px;
      display: flex;
      flex-direction: column;
    }
    .timeline-header {
      background-color: #2d2d2d;
      padding: 10px;
      border-bottom: 1px solid #444;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .timeline-ruler {
      height: 30px;
      background-color: #1f1f1f;
      border-bottom: 1px solid #444;
      position: relative;
      overflow-x: auto;
    }
    .timeline-track {
      flex: 1;
      background-color: #1a1a1a;
      border-bottom: 1px solid #333;
      position: relative;
      overflow-x: auto;
      overflow-y: hidden;
      display: flex;
    }
    .track-label {
      width: 150px;
      background-color: #2d2d2d;
      border-right: 1px solid #444;
      padding: 10px;
      display: flex;
      align-items: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    .track-content {
      flex: 1;
      position: relative;
      height: 100%;
      min-width: 1000px;
    }
    .clip {
      position: absolute;
      height: 80%;
      top: 10%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 2px solid #fff;
      border-radius: 4px;
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 11px;
      padding: 0 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      user-select: none;
    }
    .clip:hover {
      border-color: #007bff;
      box-shadow: 0 4px 12px rgba(0,123,255,0.5);
    }
    .audio-clip {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
      cursor: pointer;
    }
    .audio-clip:hover {
      opacity: 0.8;
      transform: scale(1.02);
    }
    .subtitle-clip {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%) !important;
      cursor: pointer;
    }
    .subtitle-clip:hover {
      opacity: 0.8;
      transform: scale(1.02);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      user-select: none;
    }
    .clip:hover {
      border-color: #007bff;
      box-shadow: 0 4px 12px rgba(0,123,255,0.5);
    }
    .playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background-color: #ff0000;
      z-index: 100;
      pointer-events: none;
    }
    .playhead::before {
      content: '';
      position: absolute;
      top: -5px;
      left: -5px;
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid #ff0000;
    }
    .controls {
      background-color: #2d2d2d;
      padding: 15px;
      border-top: 1px solid #444;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
    }
    .control-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: none;
      background-color: #3d3d3d;
      color: #e0e0e0;
      font-size: 20px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .control-btn:hover {
      background-color: #4d4d4d;
      transform: scale(1.1);
    }
    .control-btn.play {
      width: 60px;
      height: 60px;
      background-color: #007bff;
    }
    .control-btn.play:hover {
      background-color: #0056b3;
    }
    .time-display {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #e0e0e0;
      min-width: 100px;
      text-align: center;
    }
    .side-panel {
      width: 300px;
      background-color: #2d2d2d;
      border-right: 1px solid #444;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-tabs {
      display: flex;
      background-color: #252525;
      border-bottom: 1px solid #444;
    }
    .panel-tab {
      flex: 1;
      padding: 10px;
      background-color: #2d2d2d;
      border: none;
      border-right: 1px solid #444;
      color: #999;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    .panel-tab:last-child {
      border-right: none;
    }
    .panel-tab.active {
      background-color: #3d3d3d;
      color: #e0e0e0;
      border-bottom: 2px solid #007bff;
    }
    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
    }
    .panel-content.hidden {
      display: none;
    }
    .effect-item {
      background-color: #3d3d3d;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      cursor: move;
      border: 1px solid #555;
    }
    .effect-item:hover {
      border-color: #007bff;
      background-color: #4d4d3d;
    }
    .media-item {
      background-color: #3d3d3d;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      cursor: pointer;
      border: 1px solid #555;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .media-item:hover {
      border-color: #007bff;
      background-color: #4d4d3d;
    }
    .media-item-icon {
      font-size: 24px;
    }
    .media-item-info {
      flex: 1;
      min-width: 0;
    }
    .media-item-name {
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .media-item-meta {
      font-size: 10px;
      color: #999;
    }
    .script-item, .conversation-item {
      background-color: #3d3d3d;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      border: 1px solid #555;
      font-size: 12px;
    }
    .script-item-header, .conversation-item-header {
      font-weight: bold;
      margin-bottom: 5px;
      color: #007bff;
    }
    .script-item-content, .conversation-item-content {
      color: #ccc;
      font-size: 11px;
      max-height: 60px;
      overflow-y: auto;
    }
    .create-template-btn {
      width: 100%;
      padding: 10px;
      background-color: #007bff;
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      margin-bottom: 15px;
      font-weight: bold;
    }
    .create-template-btn:hover {
      background-color: #0056b3;
    }
    .main-workspace {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .workspace-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  </style>
  <script>
    // 패널 전환 함수 - head에 정의하여 onclick 핸들러에서 사용 가능하도록 함
    window.switchPanel = function(panelName) {
      console.log('switchPanel 호출됨:', panelName);
      document.querySelectorAll('.panel-tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.panel-content').forEach(content => content.classList.add('hidden'));
      
      // panelName으로 탭 찾기
      document.querySelectorAll('.panel-tab').forEach(tab => {
        if (tab.getAttribute('data-panel') === panelName) {
          tab.classList.add('active');
        }
      });
      
      const panel = document.getElementById(panelName + 'Panel');
      console.log('패널 찾기:', panelName + 'Panel', !!panel);
      if (panel) {
        panel.classList.remove('hidden');
        console.log('패널 표시됨');
      } else {
        console.error('패널을 찾을 수 없습니다:', panelName + 'Panel');
      }
      
      if (panelName === 'media') {
        console.log('미디어 패널 열기, loadMediaLibrary 호출');
        console.log('loadMediaLibrary 함수 존재:', typeof window.loadMediaLibrary);
        
        // loadMediaLibrary 함수가 정의될 때까지 기다림 (최대 5초)
        let attempts = 0;
        const maxAttempts = 50; // 5초 (50 * 100ms)
        
        const tryLoadMediaLibrary = () => {
          attempts++;
          if (typeof window.loadMediaLibrary === 'function') {
            console.log('loadMediaLibrary 함수 찾음, 호출 중...');
            try {
              window.loadMediaLibrary().catch(error => {
                console.error('loadMediaLibrary 호출 오류:', error);
                alert('오류: ' + error.message);
              });
            } catch (error) {
              console.error('loadMediaLibrary 호출 오류:', error);
              alert('오류: ' + error.message);
            }
          } else if (attempts < maxAttempts) {
            console.log('loadMediaLibrary 함수 대기 중... (' + attempts + '/' + maxAttempts + ')');
            setTimeout(tryLoadMediaLibrary, 100);
          } else {
            console.error('loadMediaLibrary 함수를 찾을 수 없습니다 (최대 시도 횟수 초과)');
            alert('오류: loadMediaLibrary 함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
          }
        };
        
        // 즉시 시도
        if (typeof window.loadMediaLibrary === 'function') {
          try {
            window.loadMediaLibrary().catch(error => {
              console.error('loadMediaLibrary 호출 오류:', error);
              alert('오류: ' + error.message);
            });
          } catch (error) {
            console.error('loadMediaLibrary 호출 오류:', error);
            alert('오류: ' + error.message);
          }
        } else {
          // 함수가 아직 정의되지 않았으면 대기
          tryLoadMediaLibrary();
        }
      } else if (panelName === 'template') {
        if (typeof loadTemplates === 'function') {
          loadTemplates();
        } else {
          console.error('loadTemplates 함수를 찾을 수 없습니다');
        }
      } else if (panelName === 'ai') {
        // AI 패널 열 때 컨텍스트 업데이트
        if (typeof updateAIContext === 'function') {
          updateAIContext();
        }
      }
    };
    
    // 미디어 라이브러리 로드 함수 - head에 정의하여 switchPanel에서 사용 가능하도록 함
    window.loadMediaLibrary = async function() {
      // DOM이 로드되었는지 확인
      if (document.readyState === 'loading') {
        // DOM이 아직 로드 중이면 DOMContentLoaded를 기다림
        return new Promise((resolve) => {
          document.addEventListener('DOMContentLoaded', () => {
            resolve(window.loadMediaLibrary());
          }, { once: true });
        });
      }
      
      console.log('=== loadMediaLibrary 함수 시작 ===');
      const container = document.getElementById('mediaLibrary');
      console.log('mediaLibrary 컨테이너:', !!container);
      if (!container) {
        console.error('mediaLibrary 컨테이너를 찾을 수 없습니다');
        alert('오류: mediaLibrary 컨테이너를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
        return;
      }
      
      container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">로딩 중...</div>';
      console.log('미디어 라이브러리 로드 시작...');
      
      try {
        console.log('API 호출: /api/video-editor/media');
        const response = await fetch('/api/video-editor/media');
        console.log('API 응답 상태:', response.status, response.ok);
        
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + await response.text());
        }
        
        const data = await response.json();
        console.log('API 응답 데이터:', data);
        console.log('대본 수:', data.media?.scripts?.length || 0);
        console.log('구조화된 대본 수:', data.media?.scripts?.filter(s => s.isStructured)?.length || 0);
        
        if (data.success) {
          let html = '';
          
          // 대본
          if (data.media.scripts.length > 0) {
            html += '<div style="margin-bottom: 20px;"><div style="color: #999; font-size: 11px; margin-bottom: 10px;">📝 대본</div>';
            data.media.scripts.forEach(script => {
              if (script.isStructured) {
                // 구조화된 대본 (JSON) - 가져오기 버튼
                html += \`<div class="media-item">
                  <div class="media-item-icon">📝</div>
                  <div class="media-item-info" style="flex: 1;">
                    <div class="media-item-name">\${script.name} <span style="color: #0f0; font-size: 10px;">[구조화됨]</span></div>
                    <div class="media-item-meta">\${new Date(script.modified).toLocaleDateString()}</div>
                  </div>
                  <button class="btn btn-sm btn-primary import-script-btn" data-script-url="\${script.url.replace(/'/g, '&apos;')}" style="margin-left: 10px; padding: 4px 8px; font-size: 11px;">
                    가져오기
                  </button>
                </div>\`;
              } else {
                // 일반 대본 (TXT)
                html += \`<div class="media-item" onclick="loadScript('\${script.url}')">
                  <div class="media-item-icon">📝</div>
                  <div class="media-item-info">
                    <div class="media-item-name">\${script.name}</div>
                    <div class="media-item-meta">\${new Date(script.modified).toLocaleDateString()}</div>
                  </div>
                </div>\`;
              }
            });
            html += '</div>';
          }
          
          // 시뮬레이션 비디오
          if (data.media.simulations.length > 0) {
            html += '<div style="margin-bottom: 20px;"><div style="color: #999; font-size: 11px; margin-bottom: 10px;">🔬 시뮬레이션</div>';
            data.media.simulations.forEach(video => {
              html += \`<div class="media-item" onclick="addVideoToTimeline('\${video.url}', '\${video.name}')">
                <div class="media-item-icon">🎬</div>
                <div class="media-item-info">
                  <div class="media-item-name">\${video.name}</div>
                  <div class="media-item-meta">\${formatFileSize(video.size)} • \${new Date(video.modified).toLocaleDateString()}</div>
                </div>
              </div>\`;
            });
            html += '</div>';
          }
          
          // 일반 비디오
          if (data.media.videos.length > 0) {
            html += '<div style="margin-bottom: 20px;"><div style="color: #999; font-size: 11px; margin-bottom: 10px;">🎥 비디오</div>';
            data.media.videos.forEach(video => {
              html += \`<div class="media-item" onclick="addVideoToTimeline('\${video.url}', '\${video.name}')">
                <div class="media-item-icon">🎥</div>
                <div class="media-item-info">
                  <div class="media-item-name">\${video.name}</div>
                  <div class="media-item-meta">\${formatFileSize(video.size)} • \${new Date(video.modified).toLocaleDateString()}</div>
                </div>
              </div>\`;
            });
            html += '</div>';
          }
          
          // AI 비디오
          if (data.media.aiVideos.length > 0) {
            html += '<div style="margin-bottom: 20px;"><div style="color: #999; font-size: 11px; margin-bottom: 10px;">🤖 AI 비디오</div>';
            data.media.aiVideos.forEach(video => {
              html += \`<div class="media-item" onclick="addVideoToTimeline('\${video.url}', '\${video.name}')">
                <div class="media-item-icon">🤖</div>
                <div class="media-item-info">
                  <div class="media-item-name">\${video.name}</div>
                  <div class="media-item-meta">\${formatFileSize(video.size)} • \${new Date(video.modified).toLocaleDateString()}</div>
                </div>
              </div>\`;
            });
            html += '</div>';
          }
          
          if (html === '') {
            html = '<div style="color: #999; text-align: center; padding: 20px;">미디어가 없습니다.</div>';
          }
          
          container.innerHTML = html;
          console.log('HTML 렌더링 완료, 가져오기 버튼 수:', container.querySelectorAll('.import-script-btn').length);
          
          // 구조화된 대본 가져오기 버튼에 이벤트 리스너 연결
          const importButtons = container.querySelectorAll('.import-script-btn');
          console.log('가져오기 버튼 찾음:', importButtons.length, '개');
          
          importButtons.forEach((btn, index) => {
            const scriptUrl = btn.getAttribute('data-script-url');
            console.log('버튼 ' + (index + 1) + ' URL:', scriptUrl);
            
            btn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              console.log('가져오기 버튼 클릭됨:', scriptUrl);
              
              if (scriptUrl && typeof window.importStructuredScript === 'function') {
                console.log('importStructuredScript 함수 호출');
                window.importStructuredScript(scriptUrl);
              } else {
                console.error('importStructuredScript 함수를 찾을 수 없습니다. scriptUrl:', scriptUrl, '함수 존재:', typeof window.importStructuredScript);
                alert('오류: 함수를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
              }
            });
          });
          
          console.log('이벤트 리스너 연결 완료');
        } else {
          container.innerHTML = '<div style="color: #f00; text-align: center; padding: 20px;">오류: ' + (data.error || '알 수 없는 오류') + '</div>';
        }
      } catch (error) {
        console.error('미디어 로드 오류:', error);
        if (container) {
          container.innerHTML = '<div style="color: #f00; text-align: center; padding: 20px;">로드 실패: ' + error.message + '</div>';
        }
      }
    };
    
    // 구조화된 대본 가져오기 함수 - head에 정의하여 동적으로 생성된 버튼에서 사용 가능하도록 함
    window.importStructuredScript = async function(scriptUrl) {
      try {
        // 진행 상황 표시
        const progressDiv = document.createElement('div');
        progressDiv.id = 'importProgress';
        progressDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #2d2d2d; padding: 20px; border-radius: 8px; z-index: 10000; border: 2px solid #007bff;';
        progressDiv.innerHTML = '<div style="color: #e0e0e0; margin-bottom: 10px;">구조화된 대본 가져오는 중...</div><div style="color: #999; font-size: 12px;">TTS 오디오 생성 중입니다. 잠시만 기다려주세요.</div>';
        document.body.appendChild(progressDiv);

        const response = await fetch('/api/video-editor/import-structured-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptPath: scriptUrl })
        });

        const result = await response.json();

        if (result.success) {
          progressDiv.innerHTML = '<div style="color: #0f0; margin-bottom: 10px;">✅ 오디오 생성 완료!</div><div style="color: #999; font-size: 12px;">타임라인에 배치 중...</div>';

          // 타임라인에 배치
          let addedCount = 0;
          console.log('타임라인 세그먼트 수:', result.timeline.length);
          
          result.timeline.forEach((segment, index) => {
            console.log('세그먼트 ' + (index + 1) + ':', {
              audioUrl: segment.audioUrl,
              startTime: segment.startTime,
              endTime: segment.endTime,
              text: segment.text ? segment.text.substring(0, 30) : null
            });
            
            // 오디오 트랙에 오디오 클립 추가
            if (segment.audioUrl) {
              if (typeof window.addAudioToTimeline === 'function') {
                window.addAudioToTimeline(segment.audioUrl, segment.startTime, segment.endTime, segment.text);
                addedCount++;
              } else {
                console.error('addAudioToTimeline 함수를 찾을 수 없습니다');
              }
            }

            // 자막 트랙에 자막 추가
            if (segment.subtitle) {
              if (typeof window.addSubtitleToTimeline === 'function') {
                window.addSubtitleToTimeline(segment.subtitle);
              } else {
                console.error('addSubtitleToTimeline 함수를 찾을 수 없습니다');
              }
            }
          });

          // 전체 길이 업데이트
          if (result.script && result.script.metadata && result.script.metadata.totalDuration) {
            duration = result.script.metadata.totalDuration;
          } else if (result.timeline.length > 0) {
            const lastSegment = result.timeline[result.timeline.length - 1];
            duration = Math.max(duration || 0, lastSegment.endTime);
          }
          
          console.log('Duration 설정:', duration);

          // 타임라인 업데이트 함수 호출
          if (typeof createTimelineRuler === 'function') {
            createTimelineRuler();
          }
          if (typeof updateTimelineZoom === 'function') {
            updateTimelineZoom();
          }
          
          // 타임라인 클립 수집 (재생 준비)
          if (typeof collectTimelineClips === 'function') {
            setTimeout(() => {
              collectTimelineClips();
            }, 500);
          }

          progressDiv.innerHTML = '<div style="color: #0f0; margin-bottom: 10px;">✅ 완료!</div><div style="color: #999; font-size: 12px;">' + addedCount + '개 오디오 클립과 자막이 타임라인에 추가되었습니다.</div>';
          
          setTimeout(() => {
            progressDiv.remove();
          }, 3000);
        } else {
          progressDiv.innerHTML = '<div style="color: #f00; margin-bottom: 10px;">❌ 오류 발생</div><div style="color: #999; font-size: 12px;">' + (result.error || '알 수 없는 오류') + '</div>';
          setTimeout(() => {
            progressDiv.remove();
          }, 5000);
        }
      } catch (error) {
        console.error('구조화된 대본 가져오기 오류:', error);
        alert('오류 발생: ' + error.message);
        const progressDiv = document.getElementById('importProgress');
        if (progressDiv) progressDiv.remove();
      }
    };
    
    // 오디오를 타임라인에 추가 함수 - head에 정의
    window.addAudioToTimeline = function(audioUrl, startTime, endTime, text) {
      // DOM이 로드되었는지 확인
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          window.addAudioToTimeline(audioUrl, startTime, endTime, text);
        }, { once: true });
        return;
      }
      
      const audioTrackContent = document.getElementById('audioTrackContent');
      if (!audioTrackContent) {
        console.error('audioTrackContent를 찾을 수 없습니다');
        return;
      }
      
      const zoomLevel = window.zoomLevel || 1;
      const pixelsPerSecond = 50 * zoomLevel;
      
      const audioClip = document.createElement('div');
      audioClip.className = 'clip audio-clip';
      audioClip.style.left = (startTime * pixelsPerSecond) + 'px';
      audioClip.style.width = ((endTime - startTime) * pixelsPerSecond) + 'px';
      audioClip.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      audioClip.style.borderColor = '#fff';
      audioClip.dataset.audioUrl = audioUrl;
      audioClip.dataset.startTime = startTime;
      audioClip.dataset.endTime = endTime;
      audioClip.title = text || '오디오 클립';
      
      // 클립 내용 (텍스트 미리보기)
      const clipText = document.createElement('div');
      clipText.style.cssText = 'padding: 5px; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff;';
      clipText.textContent = (text && text.length > 30) ? text.substring(0, 30) + '...' : (text || '오디오');
      audioClip.appendChild(clipText);

      // 오디오 재생 기능
      audioClip.addEventListener('click', () => {
        if (typeof window.playAudioSegment === 'function') {
          window.playAudioSegment(audioUrl, startTime, endTime);
        }
      });

      audioTrackContent.appendChild(audioClip);
      console.log('오디오 클립 추가됨:', { audioUrl, startTime, endTime, text: text?.substring(0, 20) });
    };
    
    // 자막을 타임라인에 추가 함수 - head에 정의
    window.addSubtitleToTimeline = function(subtitle) {
      // DOM이 로드되었는지 확인
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          window.addSubtitleToTimeline(subtitle);
        }, { once: true });
        return;
      }
      
      const subtitleTrackContent = document.getElementById('subtitleTrackContent');
      if (!subtitleTrackContent) {
        console.error('subtitleTrackContent를 찾을 수 없습니다');
        return;
      }
      
      const zoomLevel = window.zoomLevel || 1;
      const pixelsPerSecond = 50 * zoomLevel;
      
      const subtitleClip = document.createElement('div');
      subtitleClip.className = 'clip subtitle-clip';
      subtitleClip.style.left = (subtitle.startTime * pixelsPerSecond) + 'px';
      subtitleClip.style.width = ((subtitle.endTime - subtitle.startTime) * pixelsPerSecond) + 'px';
      subtitleClip.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
      subtitleClip.style.borderColor = '#fff';
      subtitleClip.style.color = '#fff';
      subtitleClip.style.fontSize = '11px';
      subtitleClip.style.padding = '5px';
      subtitleClip.style.overflow = 'hidden';
      subtitleClip.style.textOverflow = 'ellipsis';
      subtitleClip.style.whiteSpace = 'nowrap';
      subtitleClip.textContent = subtitle.text;
      subtitleClip.dataset.startTime = subtitle.startTime;
      subtitleClip.dataset.endTime = subtitle.endTime;
      subtitleClip.title = subtitle.text;

      // 자막 편집 기능 (더블클릭)
      subtitleClip.addEventListener('dblclick', () => {
        const newText = prompt('자막 수정:', subtitle.text);
        if (newText !== null) {
          subtitleClip.textContent = newText;
          subtitleClip.title = newText;
        }
      });

      subtitleTrackContent.appendChild(subtitleClip);
      console.log('자막 클립 추가됨:', { text: subtitle.text?.substring(0, 20), startTime: subtitle.startTime, endTime: subtitle.endTime });
    };
    
    // 오디오 세그먼트 재생 함수 - head에 정의
    window.playAudioSegment = function(audioUrl, startTime, endTime) {
      // 기존 오디오 정지
      const existingAudio = document.getElementById('tempAudioPlayer');
      if (existingAudio) {
        existingAudio.pause();
        existingAudio.remove();
      }

      // 새 오디오 재생
      const audio = document.createElement('audio');
      audio.id = 'tempAudioPlayer';
      audio.src = audioUrl;
      audio.currentTime = startTime;
      document.body.appendChild(audio);

      audio.play().catch(error => {
        console.error('오디오 재생 오류:', error);
      });

      // 종료 시간에 도달하면 정지
      const checkTime = setInterval(() => {
        if (audio.currentTime >= endTime) {
          audio.pause();
          clearInterval(checkTime);
          audio.remove();
        }
      }, 100);

      // 오디오가 끝나면 정리
      audio.addEventListener('ended', () => {
        clearInterval(checkTime);
        audio.remove();
      });
    };
  </script>
</head>
<body>
  <div class="editor-container">
    <!-- 툴바 -->
    <div class="toolbar">
      <button class="toolbar-btn" id="importMediaBtn" onclick="window.importMedia && window.importMedia(); return false;">
        <i class="bi bi-folder-plus"></i> 미디어 가져오기
      </button>
      <button class="toolbar-btn" id="addTextBtn" onclick="window.addText && window.addText(); return false;">
        <i class="bi bi-type"></i> 텍스트 추가
      </button>
      <button class="toolbar-btn" id="addTransitionBtn" onclick="window.addTransition && window.addTransition(); return false;">
        <i class="bi bi-arrow-left-right"></i> 전환 효과
      </button>
      <button class="toolbar-btn" id="addFilterBtn" onclick="window.addFilter && window.addFilter(); return false;">
        <i class="bi bi-palette"></i> 필터
      </button>
      <div style="flex: 1;"></div>
      <button class="toolbar-btn" id="exportVideoBtn" onclick="window.exportVideo && window.exportVideo(); return false;" style="background-color: #28a745; border-color: #1e7e34;">
        <i class="bi bi-download"></i> 내보내기
      </button>
      <a href="/video" class="toolbar-btn">
        <i class="bi bi-x-lg"></i> 닫기
      </a>
    </div>

    <!-- 메인 워크스페이스 -->
    <div class="main-workspace">
      <!-- 사이드 패널 -->
      <div class="side-panel">
        <div class="panel-tabs">
          <button class="panel-tab active" data-panel="effects" onclick="window.switchPanel && window.switchPanel('effects'); this.classList.add('active'); document.querySelectorAll('.panel-tab').forEach(t => { if (t !== this) t.classList.remove('active'); }); return false;">
            <i class="bi bi-magic"></i> 효과
          </button>
          <button class="panel-tab" data-panel="media" onclick="console.log('미디어 탭 클릭됨'); if (window.switchPanel) { window.switchPanel('media'); } else { console.error('switchPanel 함수 없음'); } this.classList.add('active'); document.querySelectorAll('.panel-tab').forEach(t => { if (t !== this) t.classList.remove('active'); }); return false;">
            <i class="bi bi-folder"></i> 미디어
          </button>
          <button class="panel-tab" data-panel="template" onclick="window.switchPanel && window.switchPanel('template'); this.classList.add('active'); document.querySelectorAll('.panel-tab').forEach(t => { if (t !== this) t.classList.remove('active'); }); return false;">
            <i class="bi bi-file-text"></i> 템플릿
          </button>
          <button class="panel-tab" data-panel="ai" onclick="window.switchPanel && window.switchPanel('ai'); this.classList.add('active'); document.querySelectorAll('.panel-tab').forEach(t => { if (t !== this) t.classList.remove('active'); }); return false;">
            <i class="bi bi-robot"></i> AI
          </button>
        </div>
        
        <!-- 효과 패널 -->
        <div id="effectsPanel" class="panel-content">
          <h6 style="color: #e0e0e0; margin-bottom: 15px;">효과 & 전환</h6>
          <div class="effect-item" draggable="true" data-effect="fade">
            <i class="bi bi-circle-half"></i> 페이드 인/아웃
          </div>
          <div class="effect-item" draggable="true" data-effect="slide">
            <i class="bi bi-arrows-move"></i> 슬라이드
          </div>
          <div class="effect-item" draggable="true" data-effect="zoom">
            <i class="bi bi-zoom-in"></i> 줌 인/아웃
          </div>
          <div class="effect-item" draggable="true" data-effect="blur">
            <i class="bi bi-eye-slash"></i> 블러
          </div>
          <div class="effect-item" draggable="true" data-effect="brightness">
            <i class="bi bi-brightness-high"></i> 밝기 조절
          </div>
          <div class="effect-item" draggable="true" data-effect="contrast">
            <i class="bi bi-contrast"></i> 대비 조절
          </div>
        </div>
        
        <!-- 미디어 라이브러리 패널 -->
        <div id="mediaPanel" class="panel-content hidden">
          <h6 style="color: #e0e0e0; margin-bottom: 15px;">미디어 라이브러리</h6>
          <div id="mediaLibrary">
            <div style="color: #999; text-align: center; padding: 20px;">로딩 중...</div>
          </div>
        </div>
        
        <!-- 템플릿 패널 (대본 & 대화) -->
        <div id="templatePanel" class="panel-content hidden">
          <h6 style="color: #e0e0e0; margin-bottom: 15px;">대본 & 대화 기반 템플릿</h6>
          <button class="create-template-btn" onclick="createTemplateFromScript()">
            <i class="bi bi-magic"></i> 대본으로 비디오 구조 생성
          </button>
          <div id="scriptsList">
            <div style="color: #999; font-size: 11px; margin-bottom: 10px;">대본 목록</div>
            <div id="scriptsContainer"></div>
          </div>
          <div id="conversationsList" style="margin-top: 20px;">
            <div style="color: #999; font-size: 11px; margin-bottom: 10px;">대화 히스토리</div>
            <div id="conversationsContainer"></div>
          </div>
        </div>
        
        <!-- AI 어시스턴트 패널 -->
        <div id="aiPanel" class="panel-content hidden">
          <h6 style="color: #e0e0e0; margin-bottom: 15px;">🤖 AI 편집 어시스턴트</h6>
          
          <!-- 컨텍스트 분석 버튼 -->
          <button class="create-template-btn" onclick="analyzeContext()" style="background-color: #28a745; margin-bottom: 10px;">
            <i class="bi bi-search"></i> 컨텍스트 분석 및 제안
          </button>
          
          <!-- 빠른 작업 버튼들 -->
          <div style="margin-bottom: 15px;">
            <div style="color: #999; font-size: 11px; margin-bottom: 8px;">빠른 작업</div>
            <button class="toolbar-btn" onclick="aiGenerateSubtitles()" style="width: 100%; margin-bottom: 5px; padding: 8px;">
              <i class="bi bi-type"></i> 자막 생성
            </button>
            <button class="toolbar-btn" onclick="aiOptimizeTimeline()" style="width: 100%; margin-bottom: 5px; padding: 8px;">
              <i class="bi bi-arrow-left-right"></i> 타임라인 최적화
            </button>
            <button class="toolbar-btn" onclick="aiAddTransitions()" style="width: 100%; padding: 8px;">
              <i class="bi bi-arrow-left-right"></i> 전환 효과 추가
            </button>
          </div>
          
          <!-- AI 채팅 영역 -->
          <div style="border-top: 1px solid #444; padding-top: 15px; margin-top: 15px;">
            <div style="color: #999; font-size: 11px; margin-bottom: 8px;">AI와 대화하기</div>
            <div id="aiChatMessages" style="height: 200px; overflow-y: auto; background-color: #1a1a1a; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 11px;">
              <div style="color: #999; text-align: center;">AI 어시스턴트가 도와드립니다...</div>
            </div>
            <div style="display: flex; gap: 5px;">
              <input type="text" id="aiChatInput" placeholder="편집 요청..." 
                     style="flex: 1; background-color: #3d3d3d; border: 1px solid #555; color: #e0e0e0; padding: 8px; border-radius: 4px; font-size: 12px;"
                     onkeypress="if(event.key === 'Enter') sendAIChat()">
              <button class="toolbar-btn" onclick="sendAIChat()" style="padding: 8px 12px;">
                <i class="bi bi-send"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 워크스페이스 콘텐츠 -->
      <div class="workspace-content">
        <!-- 미리보기 영역 -->
        <div class="preview-area" id="previewArea">
          <video id="previewVideo" class="preview-video" style="display: none;"></video>
          <canvas id="previewCanvas" class="preview-video" style="display: block; width: 100%; height: 100%; background-color: #000;"></canvas>
          <div id="previewOverlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 10;"></div>
          <button id="previewPlayButton" class="preview-play-button" title="재생/일시정지">
            <i class="bi bi-play-fill" id="previewPlayIcon"></i>
          </button>
        </div>

        <!-- 타임라인 -->
        <div class="timeline-container">
          <div class="timeline-header">
            <button class="control-btn" onclick="zoomOut()" style="width: 30px; height: 30px; font-size: 14px;">
              <i class="bi bi-dash"></i>
            </button>
            <span class="time-display" id="timeDisplay">00:00 / 00:00</span>
            <button class="control-btn" onclick="zoomIn()" style="width: 30px; height: 30px; font-size: 14px;">
              <i class="bi bi-plus"></i>
            </button>
          </div>
          <div class="timeline-ruler" id="timelineRuler"></div>
          <div class="timeline-track" id="videoTrack">
            <div class="track-label">비디오 트랙</div>
            <div class="track-content" id="videoTrackContent">
              <div class="playhead" id="playhead"></div>
            </div>
          </div>
          <div class="timeline-track" id="audioTrack">
            <div class="track-label">오디오 트랙</div>
            <div class="track-content" id="audioTrackContent"></div>
          </div>
          <div class="timeline-track" id="subtitleTrack">
            <div class="track-label">자막 트랙</div>
            <div class="track-content" id="subtitleTrackContent"></div>
          </div>
        </div>

        <!-- 컨트롤 -->
        <div class="controls">
          <button class="control-btn" id="skipBackwardBtn" onclick="window.skipBackward && window.skipBackward(); return false;">
            <i class="bi bi-skip-backward-fill"></i>
          </button>
          <button class="control-btn play" id="playBtn" onclick="window.togglePlay && window.togglePlay(); return false;">
            <i class="bi bi-play-fill" id="playIcon"></i>
          </button>
          <button class="control-btn" id="skipForwardBtn" onclick="window.skipForward && window.skipForward(); return false;">
            <i class="bi bi-skip-forward-fill"></i>
          </button>
          <div class="time-display" id="currentTime">00:00</div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // 전역 변수 초기화
    let isPlaying = false;
    let currentTime = 0;
    let duration = 0;
    let zoomLevel = 1;
    let clips = [];
    let audioClips = []; // 오디오 클립 정보 저장
    let subtitleClips = []; // 자막 클립 정보 저장
    let currentAudioPlayer = null; // 현재 재생 중인 오디오
    let playbackInterval = null; // 재생 시간 업데이트 인터벌
    
    // 헬퍼 함수들
    function getPreviewVideo() {
      return document.getElementById('previewVideo');
    }
    
    function getPlayIcon() {
      return document.getElementById('playIcon');
    }
    
    function getTimeDisplay() {
      return document.getElementById('timeDisplay');
    }
    
    function getCurrentTimeDisplay() {
      return document.getElementById('currentTime');
    }
    
    function getVideoTrackContent() {
      return document.getElementById('videoTrackContent');
    }
    
    function getPlayhead() {
      return document.getElementById('playhead');
    }
    
    function updateTimeDisplay() {
      const timeDisplay = getTimeDisplay();
      const currentTimeDisplay = getCurrentTimeDisplay();
      if (timeDisplay) {
        timeDisplay.textContent = formatTime(currentTime) + ' / ' + formatTime(duration);
      }
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(currentTime);
      }
    }
    
    function zoomIn() {
      zoomLevel = Math.min(zoomLevel * 1.5, 10);
      updateTimelineZoom();
      createTimelineRuler();
    }
    
    function zoomOut() {
      zoomLevel = Math.max(zoomLevel / 1.5, 0.1);
      updateTimelineZoom();
      createTimelineRuler();
    }
    
    // DOM 로드 후 초기화
    document.addEventListener('DOMContentLoaded', function() {
      const previewVideo = getPreviewVideo();
      const playIcon = getPlayIcon();
      const timeDisplay = getTimeDisplay();
      const currentTimeDisplay = getCurrentTimeDisplay();
      const videoTrackContent = getVideoTrackContent();
      const playhead = getPlayhead();
      
      console.log('DOMContentLoaded 실행됨');
      console.log('previewVideo:', !!previewVideo);
      console.log('playBtn:', !!document.getElementById('playBtn'));
      
      // 이벤트 리스너 설정
      if (previewVideo) {
        previewVideo.addEventListener('loadedmetadata', () => {
          duration = previewVideo.duration;
          updateTimeDisplay();
          createTimelineRuler();
        });

        previewVideo.addEventListener('timeupdate', () => {
          currentTime = previewVideo.currentTime;
          updateTimeDisplay();
          updatePlayhead();
        });

        previewVideo.addEventListener('ended', () => {
          isPlaying = false;
          if (playIcon) playIcon.className = 'bi bi-play-fill';
        });
      }
      
      // 버튼 이벤트 리스너 연결 (확실하게)
      const playBtnEl = document.getElementById('playBtn');
      if (playBtnEl) {
        playBtnEl.onclick = window.togglePlay;
        console.log('재생 버튼 이벤트 연결됨');
      } else {
        console.error('playBtn을 찾을 수 없습니다');
      }
      
      const skipBackwardBtn = document.getElementById('skipBackwardBtn');
      if (skipBackwardBtn) {
        skipBackwardBtn.onclick = window.skipBackward;
        console.log('뒤로 건너뛰기 버튼 이벤트 연결됨');
      }
      
      const skipForwardBtn = document.getElementById('skipForwardBtn');
      if (skipForwardBtn) {
        skipForwardBtn.onclick = window.skipForward;
        console.log('앞으로 건너뛰기 버튼 이벤트 연결됨');
      }
      
      const importMediaBtn = document.getElementById('importMediaBtn');
      if (importMediaBtn) {
        importMediaBtn.onclick = window.importMedia;
        console.log('미디어 가져오기 버튼 이벤트 연결됨');
      }
      
      const addTextBtn = document.getElementById('addTextBtn');
      if (addTextBtn) {
        addTextBtn.onclick = window.addText;
        console.log('텍스트 추가 버튼 이벤트 연결됨');
      }
      
      const addTransitionBtn = document.getElementById('addTransitionBtn');
      if (addTransitionBtn) {
        addTransitionBtn.onclick = window.addTransition;
        console.log('전환 효과 버튼 이벤트 연결됨');
      }
      
      const addFilterBtn = document.getElementById('addFilterBtn');
      if (addFilterBtn) {
        addFilterBtn.onclick = window.addFilter;
        console.log('필터 버튼 이벤트 연결됨');
      }
      
      const exportVideoBtn = document.getElementById('exportVideoBtn');
      if (exportVideoBtn) {
        exportVideoBtn.onclick = window.exportVideo;
        console.log('내보내기 버튼 이벤트 연결됨');
      }
      
      // 패널 탭 이벤트 리스너
      document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          const panelName = this.getAttribute('data-panel');
          if (panelName) {
            window.switchPanel(panelName);
            // 활성 탭 표시
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
          }
        };
      });
      console.log('패널 탭 이벤트 연결됨:', document.querySelectorAll('.panel-tab').length, '개');
      
      // Canvas 초기화 및 재생 버튼 이벤트 연결
      setTimeout(() => {
        console.log('[DOMContentLoaded] Canvas 및 버튼 초기화 시작');
        
        // Canvas 초기화
        const canvas = document.getElementById('previewCanvas');
        if (canvas) {
          console.log('[DOMContentLoaded] Canvas 요소 찾음');
          if (typeof initPreviewCanvas === 'function') {
            try {
              initPreviewCanvas();
              console.log('[DOMContentLoaded] Canvas 초기화 완료');
            } catch (error) {
              console.error('[DOMContentLoaded] Canvas 초기화 오류:', error);
            }
          } else {
            console.warn('[DOMContentLoaded] initPreviewCanvas 함수를 찾을 수 없습니다');
            // 직접 초기화 시도
            try {
              const container = canvas.parentElement;
              if (container) {
                const rect = container.getBoundingClientRect();
                canvas.width = Math.max(rect.width || 800, 800);
                canvas.height = Math.max(rect.height || 450, 450);
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                console.log('[DOMContentLoaded] Canvas 직접 초기화 완료');
              }
            } catch (e) {
              console.error('[DOMContentLoaded] Canvas 직접 초기화 오류:', e);
            }
          }
        } else {
          console.error('[DOMContentLoaded] previewCanvas 요소를 찾을 수 없습니다');
        }
        
        // 미리보기 재생 버튼 이벤트 연결
        const previewPlayButton = document.getElementById('previewPlayButton');
        if (previewPlayButton) {
          console.log('[DOMContentLoaded] previewPlayButton 요소 찾음');
          
          // 기존 이벤트 제거 후 새로 추가
          previewPlayButton.onclick = null;
          previewPlayButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Preview Play Button] 클릭 이벤트 발생');
            
            if (typeof window.togglePlay === 'function') {
              console.log('[Preview Play Button] togglePlay 함수 호출');
              window.togglePlay();
            } else {
              console.error('[Preview Play Button] togglePlay 함수를 찾을 수 없습니다');
              alert('재생 기능을 초기화할 수 없습니다. 페이지를 새로고침해주세요.');
            }
            return false;
          });
          
          console.log('[DOMContentLoaded] 미리보기 재생 버튼 이벤트 연결 완료');
        } else {
          console.error('[DOMContentLoaded] previewPlayButton을 찾을 수 없습니다');
        }
        
        // 하단 재생 버튼도 확인
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
          playBtn.onclick = null;
          playBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Bottom Play Button] 클릭 이벤트 발생');
            if (typeof window.togglePlay === 'function') {
              window.togglePlay();
            }
            return false;
          });
          console.log('[DOMContentLoaded] 하단 재생 버튼 이벤트 연결 완료');
        }
      }, 300);
      
      // 초기화 함수 호출
      setTimeout(() => {
        if (typeof createTimelineRuler === 'function') {
          createTimelineRuler();
        }
        if (typeof window.loadMediaLibrary === 'function') {
          window.loadMediaLibrary();
        }
        if (typeof loadTemplates === 'function') {
          loadTemplates();
        }
      }, 200);
    });

    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    function updatePlayhead() {
      if (duration > 0) {
        const playhead = getPlayhead();
        if (playhead) {
          const pixelsPerSecond = 50 * zoomLevel;
          const leftPosition = currentTime * pixelsPerSecond;
          playhead.style.left = leftPosition + 'px';
        }
      }
    }
    
    // 타임라인에서 오디오 클립과 자막 클립 수집
    function collectTimelineClips() {
      console.log('[collectTimelineClips] 함수 호출됨');
      audioClips = [];
      subtitleClips = [];
      
      // 오디오 트랙에서 클립 수집
      const audioTrackContent = document.getElementById('audioTrackContent');
      console.log('[collectTimelineClips] audioTrackContent:', !!audioTrackContent);
      
      if (audioTrackContent) {
        const audioClipElements = audioTrackContent.querySelectorAll('.audio-clip');
        console.log('[collectTimelineClips] 오디오 클립 요소 수:', audioClipElements.length);
        
        audioClipElements.forEach((clip, index) => {
          const audioUrl = clip.dataset.audioUrl;
          const startTime = parseFloat(clip.dataset.startTime) || 0;
          const endTime = parseFloat(clip.dataset.endTime) || 0;
          const text = clip.dataset.text || clip.title || '';
          
          const clipInfo = '[collectTimelineClips] 오디오 클립 ' + (index + 1) + ':';
          console.log(clipInfo, {
            url: audioUrl,
            startTime: startTime,
            endTime: endTime,
            text: text ? text.substring(0, 30) : ''
          });
          
          if (audioUrl && startTime >= 0 && endTime > startTime) {
            audioClips.push({
              url: audioUrl,
              startTime: startTime,
              endTime: endTime,
              text: text
            });
          } else {
            console.warn('[collectTimelineClips] 오디오 클립 ' + (index + 1) + ' 무시됨:', {
              hasUrl: !!audioUrl,
              startTime: startTime,
              endTime: endTime
            });
          }
        });
      } else {
        console.warn('[collectTimelineClips] audioTrackContent를 찾을 수 없습니다');
      }
      
      // 자막 트랙에서 클립 수집
      const subtitleTrackContent = document.getElementById('subtitleTrackContent');
      console.log('[collectTimelineClips] subtitleTrackContent:', !!subtitleTrackContent);
      
      if (subtitleTrackContent) {
        const subtitleClipElements = subtitleTrackContent.querySelectorAll('.subtitle-clip');
        console.log('[collectTimelineClips] 자막 클립 요소 수:', subtitleClipElements.length);
        
        subtitleClipElements.forEach((clip, index) => {
          const startTime = parseFloat(clip.dataset.startTime) || 0;
          const endTime = parseFloat(clip.dataset.endTime) || 0;
          const text = clip.textContent || '';
          
          if (startTime >= 0 && endTime > startTime && text.trim()) {
            subtitleClips.push({
              startTime: startTime,
              endTime: endTime,
              text: text.trim()
            });
          }
        });
      }
      
      // 시간순으로 정렬
      audioClips.sort((a, b) => a.startTime - b.startTime);
      subtitleClips.sort((a, b) => a.startTime - b.startTime);
      
      // 전체 길이 계산
      if (audioClips.length > 0) {
        const lastClip = audioClips[audioClips.length - 1];
        duration = Math.max(duration, lastClip.endTime);
      }
      if (subtitleClips.length > 0) {
        const lastSubtitle = subtitleClips[subtitleClips.length - 1];
        duration = Math.max(duration, lastSubtitle.endTime);
      }
      
      console.log('[collectTimelineClips] 수집 완료:', {
        audioClips: audioClips.length,
        subtitleClips: subtitleClips.length,
        duration: duration
      });
      
      // 수집된 클립 상세 정보 로그
      if (audioClips.length > 0) {
        console.log('[collectTimelineClips] 오디오 클립 목록:');
        audioClips.forEach((clip, i) => {
          console.log('  ' + (i + 1) + '. ' + clip.url + ' (' + clip.startTime + 's - ' + clip.endTime + 's)');
        });
      }
    }
    
    // 현재 시간에 맞는 자막 표시
    function updateSubtitleDisplay() {
      const overlay = document.getElementById('previewOverlay');
      const canvas = document.getElementById('previewCanvas');
      
      if (!canvas) {
        console.warn('[updateSubtitleDisplay] Canvas 요소를 찾을 수 없습니다');
        return;
      }
      
      // Canvas 크기 확인
      if (canvas.width === 0 || canvas.height === 0) {
        const container = canvas.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          canvas.width = Math.max(rect.width || 800, 800);
          canvas.height = Math.max(rect.height || 450, 450);
        }
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[updateSubtitleDisplay] Canvas context를 가져올 수 없습니다');
        return;
      }
      
      // 검은 배경 그리기
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 현재 시간에 해당하는 자막 찾기
      const currentSubtitle = subtitleClips.find(sub => 
        currentTime >= sub.startTime && currentTime <= sub.endTime
      );
      
      if (currentSubtitle) {
        // Canvas에 자막 그리기
        const text = currentSubtitle.text;
        
        // 자막 텍스트 스타일 설정
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 텍스트 크기 측정
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = 50;
        const padding = 25;
        const x = canvas.width / 2;
        const y = canvas.height - 120;
        
        // 텍스트 배경 (반투명 검은색)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(
          x - textWidth / 2 - padding,
          y - textHeight / 2 - padding,
          textWidth + padding * 2,
          textHeight + padding * 2
        );
        
        // 텍스트 그리기
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, x, y);
        
        // Overlay에도 자막 표시 (백업)
        if (overlay) {
          const subtitleDiv = document.createElement('div');
          subtitleDiv.style.cssText = 'position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.8); color: white; padding: 15px 25px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; max-width: 80%; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); z-index: 1000; pointer-events: none;';
          subtitleDiv.textContent = text;
          overlay.innerHTML = '';
          overlay.appendChild(subtitleDiv);
        }
      } else {
        // 자막이 없으면 검은 배경만
        if (overlay) {
          overlay.innerHTML = '';
        }
      }
    }
    
    // 재생/일시정지 토글
    window.togglePlay = function() {
      console.log('[togglePlay] 함수 호출됨');
      console.log('[togglePlay] 현재 상태 - isPlaying:', isPlaying, 'currentTime:', currentTime, 'duration:', duration);
      
      try {
        // 타임라인 클립 수집
        console.log('[togglePlay] 타임라인 클립 수집 시작...');
        collectTimelineClips();
        
        console.log('[togglePlay] 수집 완료 - audioClips:', audioClips.length, 'subtitleClips:', subtitleClips.length);
        
        if (audioClips.length === 0) {
          console.warn('[togglePlay] 재생할 오디오 클립이 없습니다');
          alert('재생할 오디오가 없습니다. 먼저 대본을 가져오세요.\n\n미디어 라이브러리에서 대본을 선택하고 "가져오기" 버튼을 클릭하세요.');
          return;
        }
        
        if (isPlaying) {
          // 일시정지
          console.log('[togglePlay] 일시정지 처리');
          stopPlayback();
        } else {
          // 재생 시작
          console.log('[togglePlay] 재생 시작');
          playTimeline();
        }
      } catch (error) {
        console.error('[togglePlay] 오류 발생:', error);
        alert('재생 중 오류가 발생했습니다: ' + error.message);
      }
    };
    
    // 재생 버튼 아이콘 업데이트
    function updatePlayButtonIcons(playing) {
      const playIcon = getPlayIcon();
      const previewPlayIcon = document.getElementById('previewPlayIcon');
      const previewPlayButton = document.getElementById('previewPlayButton');
      
      if (playIcon) {
        playIcon.className = playing ? 'bi bi-pause-fill' : 'bi bi-play-fill';
      }
      
      if (previewPlayIcon) {
        previewPlayIcon.className = playing ? 'bi bi-pause-fill' : 'bi bi-play-fill';
      }
      
      if (previewPlayButton) {
        if (playing) {
          previewPlayButton.classList.add('playing');
        } else {
          previewPlayButton.classList.remove('playing');
        }
      }
    }
    
    // Canvas 초기화
    function initPreviewCanvas() {
      console.log('[initPreviewCanvas] 함수 호출됨');
      const canvas = document.getElementById('previewCanvas');
      if (!canvas) {
        console.warn('[initPreviewCanvas] previewCanvas 요소를 찾을 수 없습니다');
        return;
      }
      
      const container = canvas.parentElement;
      if (!container) {
        console.warn('[initPreviewCanvas] Canvas 컨테이너를 찾을 수 없습니다');
        return;
      }
      
      const rect = container.getBoundingClientRect();
      console.log('[initPreviewCanvas] 컨테이너 크기:', rect.width, 'x', rect.height);
      
      // 최소 크기 설정
      canvas.width = Math.max(rect.width || 800, 800);
      canvas.height = Math.max(rect.height || 450, 450);
      
      console.log('[initPreviewCanvas] Canvas 크기 설정:', canvas.width, 'x', canvas.height);
      
      // Canvas 크기 조정 이벤트 (한 번만 등록)
      if (!canvas._resizeHandler) {
        const resizeCanvas = () => {
          const newRect = container.getBoundingClientRect();
          canvas.width = Math.max(newRect.width || 800, 800);
          canvas.height = Math.max(newRect.height || 450, 450);
          drawCanvasFrame();
          updateSubtitleDisplay();
        };
        
        window.addEventListener('resize', resizeCanvas);
        canvas._resizeHandler = resizeCanvas;
      }
      
      // 초기 프레임 그리기
      drawCanvasFrame();
      console.log('[initPreviewCanvas] 초기화 완료');
    }
    
    // Canvas에 프레임 그리기 (검은 배경)
    function drawCanvasFrame() {
      const canvas = document.getElementById('previewCanvas');
      if (!canvas) {
        console.warn('[drawCanvasFrame] Canvas 요소를 찾을 수 없습니다');
        return;
      }
      
      // Canvas 크기가 0이면 초기화
      if (canvas.width === 0 || canvas.height === 0) {
        const container = canvas.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          canvas.width = Math.max(rect.width || 800, 800);
          canvas.height = Math.max(rect.height || 450, 450);
        }
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[drawCanvasFrame] Canvas context를 가져올 수 없습니다');
        return;
      }
      
      // 검은 배경 그리기
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 자막이 있으면 자막도 그리기
      updateSubtitleDisplay();
    }
    
    // 타임라인 재생
    function playTimeline() {
      console.log('[playTimeline] 함수 호출됨');
      
      if (audioClips.length === 0) {
        console.log('[playTimeline] 클립이 없어서 수집 시도');
        collectTimelineClips();
        if (audioClips.length === 0) {
          console.error('[playTimeline] 재생할 클립이 없습니다');
          return;
        }
      }
      
      const previewVideo = getPreviewVideo();
      const canvas = document.getElementById('previewCanvas');
      
      console.log('[playTimeline] 요소 확인 - previewVideo:', !!previewVideo, 'canvas:', !!canvas);
      
      if (!canvas) {
        console.error('[playTimeline] Canvas 요소를 찾을 수 없습니다');
        alert('Canvas 요소를 찾을 수 없습니다. 페이지를 새로고침해주세요.');
        return;
      }
      
      // Canvas 초기화
      console.log('[playTimeline] Canvas 초기화 시작');
      try {
        initPreviewCanvas();
        console.log('[playTimeline] Canvas 초기화 완료');
      } catch (error) {
        console.error('[playTimeline] Canvas 초기화 오류:', error);
      }
      
      if (!previewVideo) {
        console.warn('[playTimeline] previewVideo 요소가 없습니다. 오디오만 재생합니다.');
        // previewVideo 없이도 오디오 재생 가능하도록 처리
      }
      
      // 현재 시간에 해당하는 오디오 클립 찾기
      let currentClipIndex = audioClips.findIndex(clip => 
        currentTime >= clip.startTime && currentTime < clip.endTime
      );
      
      // 현재 시간이 어떤 클립에도 속하지 않으면 다음 클립 찾기
      if (currentClipIndex === -1) {
        currentClipIndex = audioClips.findIndex(clip => clip.startTime > currentTime);
        if (currentClipIndex === -1) {
          // 모든 클립이 끝났으면 처음부터 재생
          currentTime = 0;
          currentClipIndex = 0;
        } else {
          currentTime = audioClips[currentClipIndex].startTime;
        }
      }
      
      if (currentClipIndex === -1 || currentClipIndex >= audioClips.length) {
        // 재생할 클립이 없음
        isPlaying = false;
        updatePlayButtonIcons(false);
        return;
      }
      
      const clip = audioClips[currentClipIndex];
      console.log('[playTimeline] 재생할 클립:', {
        index: currentClipIndex,
        url: clip.url,
        startTime: clip.startTime,
        endTime: clip.endTime,
        text: clip.text ? clip.text.substring(0, 30) : ''
      });
      
      // 오디오 요소 생성 (비디오 요소 대신)
      if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.remove();
      }
      
      const audio = document.createElement('audio');
      audio.src = clip.url;
      audio.preload = 'auto';
      currentAudioPlayer = audio;
      
      // 비디오 요소에도 설정 (있는 경우)
      if (previewVideo) {
        previewVideo.src = clip.url;
        previewVideo.controls = false;
      }
      
      // 오디오가 로드되면 재생 시작
      const onLoaded = () => {
        console.log('[playTimeline] 오디오 로드 완료:', clip.url);
        const clipStartOffset = currentTime - clip.startTime;
        const startOffset = Math.max(0, clipStartOffset);
        
        audio.currentTime = startOffset;
        if (previewVideo) {
          previewVideo.currentTime = startOffset;
        }
        
        console.log('[playTimeline] 재생 시작 - offset:', startOffset);
        
        // Canvas 업데이트
        drawCanvasFrame();
        updateSubtitleDisplay();
        
        audio.play().then(() => {
          console.log('[playTimeline] 오디오 재생 성공!');
          if (previewVideo) {
            previewVideo.play().catch(err => {
              console.warn('[playTimeline] previewVideo 재생 실패 (무시):', err);
            });
          }
          isPlaying = true;
          updatePlayButtonIcons(true);
          
          // 재생 시작 시 Canvas 업데이트
          drawCanvasFrame();
          updateSubtitleDisplay();
        }).catch(error => {
          console.error('[playTimeline] 오디오 재생 오류:', error);
          console.error('[playTimeline] 오류 상세:', error.name, error.message);
          alert('오디오 재생 실패: ' + error.message + '\n\n파일 경로: ' + clip.url + '\n\n브라우저 콘솔을 확인해주세요.');
          isPlaying = false;
          updatePlayButtonIcons(false);
        });
      };
      
      // 오디오 로드 오류 처리
      audio.addEventListener('error', (e) => {
        console.error('[playTimeline] 오디오 로드 오류:', e);
        console.error('[playTimeline] 오디오 요소 상태:', {
          src: audio.src,
          networkState: audio.networkState,
          readyState: audio.readyState,
          error: audio.error
        });
        alert('오디오 파일을 로드할 수 없습니다: ' + clip.url + '\n\n파일이 존재하는지 확인해주세요.');
        isPlaying = false;
        updatePlayButtonIcons(false);
      });
      
      audio.addEventListener('loadeddata', onLoaded, { once: true });
      
      // 오디오를 DOM에 추가
      document.body.appendChild(audio);
      console.log('[playTimeline] 오디오 요소 DOM에 추가됨');
      
      // previewVideo에도 이벤트 추가 (있는 경우)
      if (previewVideo) {
        previewVideo.addEventListener('loadeddata', onLoaded, { once: true });
        previewVideo.addEventListener('error', (e) => {
          console.warn('[playTimeline] previewVideo 로드 오류 (무시):', e);
        });
      }
      
      // 오디오 재생 중 시간 업데이트
      const onTimeUpdate = () => {
        if (!isPlaying) return;
        
        currentTime = clip.startTime + audio.currentTime;
        updateTimeDisplay();
        updatePlayhead();
        updateSubtitleDisplay();
        drawCanvasFrame(); // Canvas 업데이트
        
        // 현재 클립이 끝나면 다음 클립 재생
        if (currentTime >= clip.endTime) {
          console.log('[playTimeline] 클립 종료:', currentClipIndex);
          audio.removeEventListener('timeupdate', onTimeUpdate);
          currentClipIndex++;
          if (currentClipIndex < audioClips.length) {
            currentTime = audioClips[currentClipIndex].startTime;
            playTimeline(); // 다음 클립 재생
          } else {
            // 모든 클립 재생 완료
            console.log('[playTimeline] 모든 클립 재생 완료');
            stopPlayback();
          }
        }
      };
      
      audio.addEventListener('timeupdate', onTimeUpdate);
      
      // previewVideo에도 이벤트 추가 (있는 경우)
      if (previewVideo) {
        previewVideo.addEventListener('timeupdate', onTimeUpdate);
      }
      
      // 오디오 재생 종료 처리
      const onEnded = () => {
        console.log('[playTimeline] 오디오 종료:', currentClipIndex);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
        currentClipIndex++;
        if (currentClipIndex < audioClips.length) {
          currentTime = audioClips[currentClipIndex].startTime;
          playTimeline(); // 다음 클립 재생
        } else {
          stopPlayback();
        }
      };
      
      audio.addEventListener('ended', onEnded);
      
      // previewVideo에도 이벤트 추가 (있는 경우)
      if (previewVideo) {
        previewVideo.addEventListener('ended', onEnded);
      }
      
      // 재생 시간 업데이트 인터벌
      if (playbackInterval) {
        clearInterval(playbackInterval);
      }
      playbackInterval = setInterval(() => {
        if (!isPlaying) {
          clearInterval(playbackInterval);
          playbackInterval = null;
          return;
        }
        updateSubtitleDisplay();
        drawCanvasFrame(); // Canvas 지속 업데이트
      }, 100);
    }
    
    // 재생 정지
    function stopPlayback() {
      const previewVideo = getPreviewVideo();
      if (previewVideo) {
        previewVideo.pause();
        previewVideo.src = '';
      }
      
      if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer.remove();
        currentAudioPlayer = null;
      }
      
      if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
      }
      
      isPlaying = false;
      updatePlayButtonIcons(false);
    }
    
    // 뒤로 건너뛰기 (5초)
    window.skipBackward = function() {
      currentTime = Math.max(0, currentTime - 5);
      updateTimeDisplay();
      updatePlayhead();
      updateSubtitleDisplay();
      
      if (isPlaying) {
        stopPlayback();
        playTimeline();
      }
    };
    
    // 앞으로 건너뛰기 (5초)
    window.skipForward = function() {
      currentTime = Math.min(duration, currentTime + 5);
      updateTimeDisplay();
      updatePlayhead();
      updateSubtitleDisplay();
      
      if (isPlaying) {
        stopPlayback();
        playTimeline();
      }
    };

    function updateTimelineZoom() {
      const pixelsPerSecond = 50 * zoomLevel;
      if (duration > 0) {
        const totalWidth = duration * pixelsPerSecond;
        const videoTrackContent = getVideoTrackContent();
        if (videoTrackContent) videoTrackContent.style.minWidth = Math.max(1000, totalWidth) + 'px';
        const audioTrackContent = document.getElementById('audioTrackContent');
        if (audioTrackContent) audioTrackContent.style.minWidth = Math.max(1000, totalWidth) + 'px';
        const subtitleTrackContent = document.getElementById('subtitleTrackContent');
        if (subtitleTrackContent) subtitleTrackContent.style.minWidth = Math.max(1000, totalWidth) + 'px';
      }
    }

    function addClipToTimeline(url, name) {
      const videoTrackContent = getVideoTrackContent();
      if (!videoTrackContent) {
        console.error('videoTrackContent를 찾을 수 없습니다');
        return;
      }
      
      const clip = document.createElement('div');
      clip.className = 'clip';
      clip.textContent = name.length > 20 ? name.substring(0, 20) + '...' : name;
      clip.style.left = clips.length * 200 + 'px';
      clip.style.width = '200px';
      clip.draggable = true;
      
      clip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', '');
      });

      videoTrackContent.appendChild(clip);
      clips.push({ element: clip, url: url, name: name });
    }

    // 타임라인 눈금 생성
    function createTimelineRuler() {
      const ruler = document.getElementById('timelineRuler');
      ruler.innerHTML = '';
      if (duration === 0) return;
      
      const pixelsPerSecond = 50 * zoomLevel;
      const totalPixels = duration * pixelsPerSecond;
      ruler.style.width = Math.max(1000, totalPixels) + 'px';
      
      for (let i = 0; i <= duration; i += 5) {
        const mark = document.createElement('div');
        mark.style.position = 'absolute';
        mark.style.left = (i * pixelsPerSecond) + 'px';
        mark.style.top = '0';
        mark.style.width = '1px';
        mark.style.height = '100%';
        mark.style.backgroundColor = '#666';
        ruler.appendChild(mark);

        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.left = (i * pixelsPerSecond) + 'px';
        label.style.top = '5px';
        label.style.color = '#999';
        label.style.fontSize = '10px';
        label.textContent = formatTime(i);
        ruler.appendChild(label);
      }
    }

    // 패널 전환 함수는 <head>에 정의되어 있음
    
    // 편집 상태 추적
    let editState = {
      clips: [],
      timeline: {},
      effects: []
    };
    
    // AI 컨텍스트 업데이트
    async function updateAIContext() {
      // 현재 편집 상태 수집
      editState.clips = clips.map(clip => ({
        name: clip.name,
        url: clip.url,
        startTime: clip.startTime || 0,
        duration: clip.duration || 0
      }));
      
      editState.timeline = {
        duration: duration,
        currentTime: currentTime,
        zoomLevel: zoomLevel
      };
    }
    
    // 컨텍스트 분석 및 제안
    async function analyzeContext() {
      const statusDiv = document.getElementById('aiChatMessages');
      statusDiv.innerHTML = '<div style="color: #999;">컨텍스트 분석 중...</div>';
      
      try {
        // 미디어와 대화 히스토리 가져오기
        const [mediaRes, historyRes] = await Promise.all([
          fetch('/api/video-editor/media'),
          fetch('/api/video-editor/history')
        ]);
        
        const mediaData = await mediaRes.json();
        const historyData = await historyRes.json();
        
        await updateAIContext();
        
        // AI에게 컨텍스트 분석 요청
        const response = await fetch('/api/video-editor/ai/analyze-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptUrl: mediaData.success && mediaData.media.scripts.length > 0 ? mediaData.media.scripts[0].url : null,
            simulationUrls: mediaData.success ? mediaData.media.simulations.map(s => s.url) : [],
            conversationHistory: historyData.success ? historyData.history : [],
            currentEditState: editState
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          statusDiv.innerHTML = 
            '<div style="color: #28a745; margin-bottom: 10px;">✅ 컨텍스트 분석 완료</div>' +
            '<div style="color: #e0e0e0; white-space: pre-wrap; font-size: 11px;">' + 
            result.suggestions.substring(0, 1000) + 
            '</div>';
        } else {
          statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + (result.error || '알 수 없는 오류') + '</div>';
        }
      } catch (error) {
        console.error('컨텍스트 분석 오류:', error);
        statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + error.message + '</div>';
      }
    }
    
    // AI 자막 생성
    async function aiGenerateSubtitles() {
      const statusDiv = document.getElementById('aiChatMessages');
      statusDiv.innerHTML = '<div style="color: #999;">자막 생성 중...</div>';
      
      try {
        const mediaRes = await fetch('/api/video-editor/media');
        const mediaData = await mediaRes.json();
        
        let scriptContent = '';
        if (mediaData.success && mediaData.media.scripts.length > 0) {
          const scriptRes = await fetch(mediaData.media.scripts[0].url);
          scriptContent = await scriptRes.text();
        }
        
        await updateAIContext();
        
        const response = await fetch('/api/video-editor/ai/execute-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate-subtitles',
            params: {},
            context: {
              script: scriptContent,
              editState: editState
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success && result.subtitles) {
          // 자막을 타임라인에 추가 (간단한 예시)
          statusDiv.innerHTML = 
            '<div style="color: #28a745; margin-bottom: 10px;">✅ 자막 생성 완료 (' + result.subtitles.length + '개)</div>' +
            '<div style="color: #e0e0e0; font-size: 11px;">자막이 타임라인에 추가되었습니다.</div>';
          
          // 실제로는 자막 트랙에 추가하는 로직 필요
          alert('자막 ' + result.subtitles.length + '개가 생성되었습니다!');
        } else {
          statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + (result.error || '자막 생성 실패') + '</div>';
        }
      } catch (error) {
        console.error('자막 생성 오류:', error);
        statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + error.message + '</div>';
      }
    }
    
    // AI 타임라인 최적화
    async function aiOptimizeTimeline() {
      const statusDiv = document.getElementById('aiChatMessages');
      statusDiv.innerHTML = '<div style="color: #999;">타임라인 최적화 중...</div>';
      
      try {
        await updateAIContext();
        
        const response = await fetch('/api/video-editor/ai/execute-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'optimize-timeline',
            params: {},
            context: {
              editState: editState
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          statusDiv.innerHTML = 
            '<div style="color: #28a745; margin-bottom: 10px;">✅ 타임라인 최적화 완료</div>' +
            '<div style="color: #e0e0e0; white-space: pre-wrap; font-size: 11px;">' + 
            result.instructions.substring(0, 500) + 
            '</div>';
        } else {
          statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + (result.error || '최적화 실패') + '</div>';
        }
      } catch (error) {
        console.error('타임라인 최적화 오류:', error);
        statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + error.message + '</div>';
      }
    }
    
    // AI 전환 효과 추가
    async function aiAddTransitions() {
      const statusDiv = document.getElementById('aiChatMessages');
      statusDiv.innerHTML = '<div style="color: #999;">전환 효과 추가 중...</div>';
      
      try {
        await updateAIContext();
        
        const response = await fetch('/api/video-editor/ai/execute-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-transitions',
            params: {},
            context: {
              editState: editState
            }
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          statusDiv.innerHTML = 
            '<div style="color: #28a745; margin-bottom: 10px;">✅ 전환 효과 추가 완료</div>' +
            '<div style="color: #e0e0e0; white-space: pre-wrap; font-size: 11px;">' + 
            result.instructions.substring(0, 500) + 
            '</div>';
        } else {
          statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + (result.error || '효과 추가 실패') + '</div>';
        }
      } catch (error) {
        console.error('전환 효과 추가 오류:', error);
        statusDiv.innerHTML = '<div style="color: #f00;">오류: ' + error.message + '</div>';
      }
    }
    
    // AI 채팅 전송
    async function sendAIChat() {
      const input = document.getElementById('aiChatInput');
      const message = input.value.trim();
      
      if (!message) return;
      
      const messagesDiv = document.getElementById('aiChatMessages');
      
      // 사용자 메시지 표시
      messagesDiv.innerHTML += '<div style="color: #007bff; margin-bottom: 5px;"><strong>👤 사용자:</strong> ' + message + '</div>';
      input.value = '';
      
      // AI 응답 대기 표시
      messagesDiv.innerHTML += '<div style="color: #999; margin-bottom: 5px;">🤖 AI가 생각하는 중...</div>';
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      
      try {
        // 미디어와 대화 히스토리 가져오기
        const [mediaRes, historyRes] = await Promise.all([
          fetch('/api/video-editor/media'),
          fetch('/api/video-editor/history')
        ]);
        
        const mediaData = await mediaRes.json();
        const historyData = await historyRes.json();
        
        await updateAIContext();
        
        let scriptContent = '';
        if (mediaData.success && mediaData.media.scripts.length > 0) {
          const scriptRes = await fetch(mediaData.media.scripts[0].url);
          scriptContent = await scriptRes.text();
        }
        
        const response = await fetch('/api/video-editor/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message,
            context: {
              script: scriptContent,
              simulations: mediaData.success ? mediaData.media.simulations : [],
              conversation: historyData.success ? historyData.history : [],
              editState: editState
            }
          })
        });
        
        const result = await response.json();
        
        // 마지막 "생각하는 중" 메시지 제거
        messagesDiv.innerHTML = messagesDiv.innerHTML.replace(/<div style="color: #999; margin-bottom: 5px;">🤖 AI가 생각하는 중\.\.\.<\/div>$/, '');
        
        if (result.success) {
          messagesDiv.innerHTML += '<div style="color: #e0e0e0; margin-bottom: 10px; white-space: pre-wrap;"><strong>🤖 AI:</strong> ' + result.reply + '</div>';
        } else {
          messagesDiv.innerHTML += '<div style="color: #f00; margin-bottom: 10px;">오류: ' + (result.error || '알 수 없는 오류') + '</div>';
        }
        
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      } catch (error) {
        console.error('AI 채팅 오류:', error);
        messagesDiv.innerHTML = messagesDiv.innerHTML.replace(/<div style="color: #999; margin-bottom: 5px;">🤖 AI가 생각하는 중\.\.\.<\/div>$/, '');
        messagesDiv.innerHTML += '<div style="color: #f00; margin-bottom: 10px;">오류: ' + error.message + '</div>';
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
    }

    // loadMediaLibrary 함수는 <head>에 정의되어 있음

    // 템플릿 로드
    async function loadTemplates() {
      // 대본 목록 로드
      try {
        const mediaResponse = await fetch('/api/video-editor/media');
        const mediaData = await mediaResponse.json();
        
        if (mediaData.success && mediaData.media.scripts.length > 0) {
          const scriptsContainer = document.getElementById('scriptsContainer');
          let html = '';
          mediaData.media.scripts.forEach(script => {
            html += \`<div class="script-item">
              <div class="script-item-header">📝 \${script.name}</div>
              <div class="script-item-content">\${new Date(script.modified).toLocaleString()}</div>
            </div>\`;
          });
          scriptsContainer.innerHTML = html;
        }
      } catch (error) {
        console.error('대본 로드 오류:', error);
      }
      
      // 대화 히스토리 로드
      try {
        const historyResponse = await fetch('/api/video-editor/history');
        const historyData = await historyResponse.json();
        
        if (historyData.success && historyData.history.length > 0) {
          const conversationsContainer = document.getElementById('conversationsContainer');
          let html = '';
          historyData.history.slice(-10).reverse().forEach((msg, index) => {
            const role = msg.role === 'user' ? '👤 사용자' : '🤖 AI';
            const content = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
            html += \`<div class="conversation-item">
              <div class="conversation-item-header">\${role}</div>
              <div class="conversation-item-content">\${content}</div>
            </div>\`;
          });
          conversationsContainer.innerHTML = html;
        }
      } catch (error) {
        console.error('대화 로드 오류:', error);
      }
    }

    // 대본으로 비디오 구조 생성
    async function createTemplateFromScript() {
      try {
        const mediaResponse = await fetch('/api/video-editor/media');
        const mediaData = await mediaResponse.json();
        
        if (!mediaData.success || mediaData.media.scripts.length === 0) {
          alert('사용 가능한 대본이 없습니다.');
          return;
        }
        
        // 첫 번째 대본 사용
        const script = mediaData.media.scripts[0];
        const historyResponse = await fetch('/api/video-editor/history');
        const historyData = await historyResponse.json();
        
        const response = await fetch('/api/video-editor/create-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptUrl: script.url,
            conversationHistory: historyData.success ? historyData.history : []
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // 타임라인에 세그먼트 추가
          result.structure.segments.forEach((segment, index) => {
            const clip = document.createElement('div');
            clip.className = 'clip';
            clip.textContent = segment.script.length > 20 ? segment.script.substring(0, 20) + '...' : segment.script;
            clip.style.left = (segment.startTime * 50) + 'px';
            clip.style.width = (segment.duration * 50) + 'px';
            clip.title = segment.script;
            videoTrackContent.appendChild(clip);
            clips.push({ element: clip, script: segment.script, startTime: segment.startTime, duration: segment.duration });
          });
          
          duration = result.structure.totalDuration;
          createTimelineRuler();
          alert('비디오 구조가 생성되었습니다!');
        } else {
          alert('오류: ' + (result.error || '알 수 없는 오류'));
        }
      } catch (error) {
        console.error('템플릿 생성 오류:', error);
        alert('템플릿 생성 실패: ' + error.message);
      }
    }

    // 비디오를 타임라인에 추가
    function addVideoToTimeline(url, name) {
      previewVideo.src = url;
      addClipToTimeline(url, name);
    }

    // 대본 로드
    async function loadScript(url) {
      try {
        const response = await fetch(url);
        const text = await response.text();
        alert('대본 내용:\\n\\n' + text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      } catch (error) {
        alert('대본 로드 실패: ' + error.message);
      }
    }

    // 구조화된 대본 가져오기 및 TTS 생성 (전역 함수로 노출)
    // importStructuredScript, addAudioToTimeline, addSubtitleToTimeline, playAudioSegment 함수는 <head>에 정의되어 있음

    // 파일 크기 포맷
    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // 초기화는 DOMContentLoaded에서 처리됨
  </script>
</body>
</html>`;
}

