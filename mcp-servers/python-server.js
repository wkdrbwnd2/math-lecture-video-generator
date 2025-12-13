const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PYTHON_MCP_PORT || 8001;
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
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
    service: 'python-mcp',
    python: PYTHON_PATH,
    port: PORT
  });
});

// Execute Python code
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
    const codeFile = path.join(TEMP_DIR, `python_${timestamp}.py`);
    const outputFile = path.join(OUTPUT_DIR, `simulation_${timestamp}.mp4`);
    
    // Write code to file
    fs.writeFileSync(codeFile, code);
    
    // Execute Python
    const pythonProcess = spawn(PYTHON_PATH, ['-u', codeFile], {
      env: { ...process.env, OUTPUT_PATH: outputFile },
      cwd: path.dirname(codeFile)
    });
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[Python MCP] stdout:', data.toString().trim());
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Python MCP] stderr:', data.toString().trim());
    });
    
    pythonProcess.on('close', (code) => {
      // Clean up temp file
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          console.error('[Python MCP] Failed to delete temp file:', e.message);
        }
      }
      
      if (code === 0) {
        // Check if output file exists
        if (fs.existsSync(outputFile)) {
          res.json({
            success: true,
            outputFile: path.basename(outputFile),
            outputPath: outputFile,
            url: `/outputs/simulations/${path.basename(outputFile)}`,
            stdout: stdout
          });
        } else {
          // Look for latest file in output directory
          const files = fs.existsSync(OUTPUT_DIR) 
            ? fs.readdirSync(OUTPUT_DIR)
              .filter(f => f.endsWith('.mp4') || f.endsWith('.gif') || f.endsWith('.avi'))
              .map(f => ({
                name: f,
                path: path.join(OUTPUT_DIR, f),
                time: fs.statSync(path.join(OUTPUT_DIR, f)).mtime.getTime()
              }))
              .sort((a, b) => b.time - a.time)
            : [];
          
          if (files.length > 0) {
            res.json({
              success: true,
              outputFile: files[0].name,
              outputPath: files[0].path,
              url: `/outputs/simulations/${files[0].name}`,
              stdout: stdout
            });
          } else {
            res.json({
              success: false,
              error: 'No output file generated',
              stdout: stdout,
              stderr: stderr
            });
          }
        }
      } else {
        res.json({
          success: false,
          error: `Python process exited with code ${code}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    
    // Timeout (5 minutes)
    setTimeout(() => {
      pythonProcess.kill();
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          // Ignore
        }
      }
      res.json({
        success: false,
        error: 'Execution timeout (5 minutes)'
      });
    }, 5 * 60 * 1000);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Python MCP Server] Running on port ${PORT}`);
  console.log(`[Python MCP Server] Python path: ${PYTHON_PATH}`);
  console.log(`[Python MCP Server] Output dir: ${OUTPUT_DIR}`);
});



