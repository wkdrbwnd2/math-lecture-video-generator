const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.BLENDER_MCP_PORT || 8003;
const BLENDER_PATH = process.env.BLENDER_PATH || 'blender';
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
    service: 'blender-mcp',
    blender: BLENDER_PATH,
    port: PORT
  });
});

// Execute Blender code
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
    const codeFile = path.join(TEMP_DIR, `blender_${timestamp}.py`);
    const outputFile = path.join(OUTPUT_DIR, `simulation_${timestamp}.mp4`);
    
    // Write code to file
    fs.writeFileSync(codeFile, code);
    
    const normalizedOutputPath = outputFile.replace(/\\/g, '/');
    const normalizedCodePath = codeFile.replace(/\\/g, '/');
    
    // Execute Blender
    const blenderProcess = spawn(BLENDER_PATH, [
      '--background',
      '--no-window-focus',
      '--no-sound',
      '--disable-autoexec',
      '--python', normalizedCodePath
    ], {
      env: { 
        ...process.env, 
        OUTPUT_PATH: normalizedOutputPath,
        BLENDER_OUTPUT_PATH: normalizedOutputPath
      },
      cwd: path.dirname(codeFile)
    });
    
    let stdout = '';
    let stderr = '';
    
    blenderProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[Blender MCP] stdout:', data.toString().trim());
    });
    
    blenderProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Blender MCP] stderr:', data.toString().trim());
    });
    
    blenderProcess.on('close', (code) => {
      // Clean up temp file
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          console.error('[Blender MCP] Failed to delete temp file:', e.message);
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
          error: `Blender process exited with code ${code}`,
          stdout: stdout,
          stderr: stderr
        });
      }
    });
    
    // Timeout (15 minutes - Blender rendering can take longer)
    setTimeout(() => {
      blenderProcess.kill();
      if (fs.existsSync(codeFile)) {
        try {
          fs.unlinkSync(codeFile);
        } catch (e) {
          // Ignore
        }
      }
      res.json({
        success: false,
        error: 'Blender execution timeout (15 minutes)'
      });
    }, 15 * 60 * 1000);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Blender MCP Server] Running on port ${PORT}`);
  console.log(`[Blender MCP Server] Blender path: ${BLENDER_PATH}`);
});

