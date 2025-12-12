const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.MATLAB_MCP_PORT || 8002;
const MATLAB_PATH = process.env.MATLAB_PATH || 'matlab';
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
    service: 'matlab-mcp',
    matlab: MATLAB_PATH,
    port: PORT
  });
});

// Execute MATLAB code
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
    const codeFile = path.join(TEMP_DIR, `matlab_${timestamp}.m`);
    const outputFile = path.join(OUTPUT_DIR, `simulation_${timestamp}.mp4`);
    
    // Write code to file
    fs.writeFileSync(codeFile, code);
    
    const scriptName = path.basename(codeFile, '.m');
    const scriptDir = path.dirname(codeFile).replace(/\\/g, '/');
    const matlabCommand = `try; cd('${scriptDir}'); run('${scriptName}'); catch ME; disp(ME.message); end; exit;`;
    
    // Execute MATLAB
    const matlabProcess = spawn(MATLAB_PATH, ['-batch', matlabCommand], {
      env: { ...process.env, OUTPUT_PATH: outputFile },
      cwd: scriptDir
    });
    
    let stdout = '';
    let stderr = '';
    
    matlabProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[MATLAB MCP] stdout:', data.toString().trim());
    });
    
    matlabProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[MATLAB MCP] stderr:', data.toString().trim());
    });
    
    matlabProcess.on('close', (code) => {
      // Clean up temp file
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          console.error('[MATLAB MCP] Failed to delete temp file:', e.message);
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
              .filter(f => f.endsWith('.mp4') || f.endsWith('.avi') || f.endsWith('.mov'))
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
          error: `MATLAB process exited with code ${code}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    
    // Timeout (10 minutes - MATLAB can take longer)
    setTimeout(() => {
      matlabProcess.kill();
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          // Ignore
        }
      }
      res.json({
        success: false,
        error: 'MATLAB execution timeout (10 minutes)'
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
  console.log(`[MATLAB MCP Server] Running on port ${PORT}`);
  console.log(`[MATLAB MCP Server] MATLAB path: ${MATLAB_PATH}`);
});

