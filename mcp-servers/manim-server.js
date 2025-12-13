const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.MANIM_MCP_PORT || 8004;
const OUTPUT_DIR = process.env.SIMULATION_OUTPUT_DIR || path.join(__dirname, '..', 'outputs', 'simulations');
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure directories exist
[OUTPUT_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'manim-mcp',
    port: PORT
  });
});

// Execute Manim code
app.post('/execute', async (req, res) => {
  const { code, options = {} } = req.body;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Code is required'
    });
  }
  
  try {
    const timestamp = Date.now();
    const codeFile = path.join(TEMP_DIR, `manim_${timestamp}.py`);
    const outputFile = path.join(OUTPUT_DIR, `simulation_${timestamp}.mp4`);
    
    // Write code to file
    fs.writeFileSync(codeFile, code);
    
    // Execute Manim (manim command)
    const manimProcess = spawn('manim', ['-ql', codeFile], {
      env: { ...process.env, OUTPUT_PATH: outputFile },
      cwd: path.dirname(codeFile)
    });
    
    let stdout = '';
    let stderr = '';
    
    manimProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[Manim MCP] stdout:', data.toString().trim());
    });
    
    manimProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Manim MCP] stderr:', data.toString().trim());
    });
    
    manimProcess.on('close', (code) => {
      // Manim outputs to media/videos directory
      const manimOutputDir = path.join(path.dirname(codeFile), 'media', 'videos');
      let generatedFile = null;
      
      if (fs.existsSync(manimOutputDir)) {
        const files = fs.readdirSync(manimOutputDir, { recursive: true })
          .filter(f => f.endsWith('.mp4'))
          .map(f => ({
            name: f,
            path: path.join(manimOutputDir, f),
            time: fs.statSync(path.join(manimOutputDir, f)).mtime.getTime()
          }))
          .sort((a, b) => b.time - a.time);
        
        if (files.length > 0) {
          generatedFile = files[0];
        }
      }
      
      // Clean up temp file
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          console.error('[Manim MCP] Failed to delete temp file:', e.message);
        }
      }
      
      if (generatedFile && fs.existsSync(generatedFile.path)) {
        // Copy to output directory
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.copyFileSync(generatedFile.path, outputFile);
        
        res.json({
          success: true,
          outputFile: path.basename(outputFile),
          outputPath: outputFile,
          url: `/outputs/simulations/${path.basename(outputFile)}`,
          stdout: stdout
        });
      } else {
        res.json({
          success: false,
          error: 'Manim did not generate output file',
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    
    // Timeout (10 minutes)
    setTimeout(() => {
      manimProcess.kill();
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          // Ignore
        }
      }
      res.json({
        success: false,
        error: 'Manim execution timeout (10 minutes)'
      });
    }, 10 * 60 * 1000);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Manim MCP Server] Running on port ${PORT}`);
});



