const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.OCTAVE_MCP_PORT || 8002;
const OCTAVE_PATH = process.env.OCTAVE_PATH || 'octave';
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
    service: 'octave-mcp',
    octave: OCTAVE_PATH,
    port: PORT
  });
});

// Execute Octave code
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
    const codeFile = path.join(TEMP_DIR, `octave_${timestamp}.m`);
    const outputFile = path.join(OUTPUT_DIR, `simulation_${timestamp}.mp4`);
    
    // Write code to file
    fs.writeFileSync(codeFile, code);
    
    const scriptName = path.basename(codeFile, '.m');
    const scriptDir = path.dirname(codeFile);
    // Octave command: octave --no-gui --eval "run('script.m')"
    const octaveCommand = `run('${scriptName}')`;
    
    // Execute Octave
    const octaveProcess = spawn(OCTAVE_PATH, [
      '--no-gui',
      '--eval', octaveCommand
    ], {
      env: { ...process.env, OUTPUT_PATH: outputFile },
      cwd: scriptDir
    });
    
    let stdout = '';
    let stderr = '';
    
    octaveProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[Octave MCP] stdout:', data.toString().trim());
    });
    
    octaveProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Octave MCP] stderr:', data.toString().trim());
    });
    
    octaveProcess.on('close', (code) => {
      // Clean up temp file
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          console.error('[Octave MCP] Failed to delete temp file:', e.message);
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
          error: `Octave process exited with code ${code}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    
    // Timeout (10 minutes)
    setTimeout(() => {
      octaveProcess.kill();
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          // Ignore
        }
      }
      res.json({
        success: false,
        error: 'Octave execution timeout (10 minutes)'
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
  console.log(`[Octave MCP Server] Running on port ${PORT}`);
  console.log(`[Octave MCP Server] Octave path: ${OCTAVE_PATH}`);
});

