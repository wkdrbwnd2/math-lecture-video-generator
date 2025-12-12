// Simulation Runner - Generates and executes code for simulations
// Supports: Python, MATLAB, R, Julia, Octave, Gnuplot, Graphviz, Processing, Manim
// MCP mode: Can execute via MCP servers for Python, MATLAB, Manim
const LocalAIApi = require('../ai/LocalAIApi');
const PromptManager = require('../ai/PromptManager');
const { pythonMCP, matlabMCP, manimMCP, octaveMCP } = require('../mcp/connection');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SimulationRunner {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'outputs', 'simulations');
    this.codeDir = path.join(__dirname, '..', 'outputs', 'simulations', 'code');
    this.ensureOutputDirs();
    
    // Supported programs configuration
    this.programs = {
      python: {
        name: 'Python',
        extension: '.py',
        keywords: ['python', 'matplotlib', 'numpy', 'plotly', 'scipy', 'pandas'],
        cmd: process.env.PYTHON_PATH || 'python',
        args: ['-u'],
      },
      matlab: {
        name: 'MATLAB',
        extension: '.m',
        keywords: ['matlab', 'simulink', 'matlab engine'],
        cmd: process.env.MATLAB_PATH || 'matlab',
        args: ['-batch'],
      },
      blender: {
        name: 'Blender',
        extension: '.py',
        keywords: ['blender', '3d', 'animation', 'rendering', 'bpy'],
        cmd: process.env.BLENDER_PATH || 'blender',
        args: ['--background'],
      },
      r: {
        name: 'R',
        extension: '.R',
        keywords: ['r', 'r language', 'ggplot2', 'plotly', 'shiny', 'statistics', 'rscript'],
        cmd: process.env.R_PATH || 'Rscript',
        args: [],
      },
      julia: {
        name: 'Julia',
        extension: '.jl',
        keywords: ['julia', 'julia language', 'pluto', 'plots', 'differential equations'],
        cmd: process.env.JULIA_PATH || 'julia',
        args: [],
      },
      octave: {
        name: 'GNU Octave',
        extension: '.m',
        keywords: ['octave', 'gnu octave', 'matlab alternative'],
        cmd: process.env.OCTAVE_PATH || 'octave',
        args: ['--no-gui'],
      },
      gnuplot: {
        name: 'Gnuplot',
        extension: '.plt',
        keywords: ['gnuplot', 'plotting', 'graph'],
        cmd: process.env.GNUPLOT_PATH || 'gnuplot',
        args: [],
      },
      graphviz: {
        name: 'Graphviz',
        extension: '.dot',
        keywords: ['graphviz', 'dot', 'diagram', 'graph', 'flowchart'],
        cmd: process.env.GRAPHVIZ_PATH || 'dot',
        args: [],
      },
      processing: {
        name: 'Processing',
        extension: '.pde',
        keywords: ['processing', 'p5.js', 'interactive', 'creative coding'],
        cmd: process.env.PROCESSING_PATH || 'processing-java',
        args: [],
      },
      manim: {
        name: 'Manim',
        extension: '.py',
        keywords: ['manim', 'mathematical animation', '3blue1brown', 'math animation'],
        cmd: process.env.MANIM_PATH || 'manim',
        args: ['-ql'],
      },
    };
  }

  ensureOutputDirs() {
    [this.outputDir, this.codeDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Detect which program to use based on conversation history
  detectProgram(conversationHistory) {
    const combinedPrompt = conversationHistory
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();
    
    // Score each program based on keyword matches
    const scores = {};
    for (const [programId, config] of Object.entries(this.programs)) {
      scores[programId] = config.keywords.reduce((score, keyword) => {
        return score + (combinedPrompt.includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);
    }
    
    // Find program with highest score
    const bestMatch = Object.entries(scores).reduce((best, [id, score]) => {
      return score > best.score ? { id, score } : best;
    }, { id: 'python', score: 0 });
    
    return bestMatch.score > 0 ? bestMatch.id : 'python'; // Default to Python
  }

  // Generate code for specific program
  async generateSimulationCode(conversationHistory, programId = null, options = {}) {
    try {
      // Auto-detect program if not specified
      if (!programId) {
        programId = this.detectProgram(conversationHistory);
      }
      
      const program = this.programs[programId] || this.programs.python;
      const generationPrompt = PromptManager.getGenerationPrompt('simulation');
      
      // Program-specific code generation instructions
      const programInstructions = {
        python: 'Generate Python code for this simulation. The code should:\n1. Use matplotlib or plotly for visualization\n2. Include all necessary imports\n3. Save the output as a video file (MP4) or animated GIF\n4. Be executable and self-contained\n\nReturn only the Python code, no explanations.',
        matlab: 'Generate MATLAB script (.m file) for this simulation. The code should:\n1. Use MATLAB plotting functions (plot, surf, animatedline, etc.)\n2. Save output as video using VideoWriter or export to MP4\n3. Include all necessary functions\n4. Be executable as a standalone script\n\nReturn only the MATLAB code, no explanations.',
        blender: 'Generate Blender Python script using bpy API for this simulation. The code should:\n1. Use Blender Python API (bpy) for 3D modeling and animation\n2. Set up scene, objects, materials, and animation\n3. Render output as MP4 video using bpy.ops.render.render(animation=True)\n4. Use OUTPUT_PATH or BLENDER_OUTPUT_PATH environment variable for output file path\n5. Set render settings: bpy.context.scene.render.filepath, bpy.context.scene.render.image_settings.file_format = \'FFMPEG\'\n6. Optimize render settings for speed: lower resolution (e.g., 1280x720) and quality if needed\n7. Include all necessary imports and setup\n8. Print progress messages for debugging\n\nIMPORTANT: The output path should be read from os.environ.get(\'OUTPUT_PATH\') or os.environ.get(\'BLENDER_OUTPUT_PATH\')\n\nReturn only the Blender Python code, no explanations.',
        r: 'Generate R script (.R file) for this simulation. The code should:\n1. Use ggplot2, plotly, or base R graphics for visualization\n2. Use animation package or save frames to create video\n3. Save output as MP4 video or animated GIF\n4. Include all necessary library() calls\n5. Be executable as a standalone script\n\nReturn only the R code, no explanations.',
        julia: 'Generate Julia script (.jl file) for this simulation. The code should:\n1. Use Plots.jl, PlotlyJS, or PyPlot for visualization\n2. Use Animation or save frames to create video\n3. Save output as MP4 video or animated GIF\n4. Include all necessary using/import statements\n5. Be executable as a standalone script\n\nReturn only the Julia code, no explanations.',
        octave: 'Generate GNU Octave script (.m file) for this simulation. The code should:\n1. Use Octave plotting functions (plot, surf, etc.)\n2. Save output as video or animated GIF\n3. Include all necessary functions\n4. Be executable as a standalone script\n5. Compatible with GNU Octave syntax\n\nReturn only the Octave code, no explanations.',
        gnuplot: 'Generate Gnuplot script (.plt file) for this simulation. The code should:\n1. Use Gnuplot plotting commands\n2. Set output format to gif animate or use ffmpeg to create video\n3. Include all necessary settings and data\n4. Save output as animated GIF or MP4\n\nReturn only the Gnuplot script, no explanations.',
        graphviz: 'Generate Graphviz DOT script (.dot file) for this simulation. The code should:\n1. Use DOT language syntax\n2. Define nodes, edges, and graph structure\n3. Include layout and styling\n4. Output should be renderable to PNG/SVG\n\nReturn only the Graphviz DOT code, no explanations.',
        processing: 'Generate Processing sketch (.pde file) for this simulation. The code should:\n1. Use Processing API for drawing and animation\n2. Include setup() and draw() functions\n3. Create animated visualization\n4. Export frames or use video library to save as MP4\n\nReturn only the Processing code, no explanations.',
        manim: 'Generate Manim animation code (.py file) for this simulation. The code should:\n1. Use Manim library (from manim import *)\n2. Create a Scene class that inherits from Scene\n3. Use Manim\'s animation functions (Create, Transform, etc.)\n4. Render mathematical animations, graphs, or visualizations\n5. The scene will be automatically rendered to video\n6. Include all necessary imports\n\nReturn only the Manim Python code, no explanations.',
      };
      
      const messages = [
        { 
          role: 'system', 
          content: generationPrompt + `\n\nGenerate code for ${program.name}.`
        },
        ...conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user',
          content: programInstructions[programId] || programInstructions.python
        }
      ];

      const resp = await LocalAIApi.createResponse({
        input: messages,
        model: options.model || require('../ai/config').default_model,
      });

      if (resp && resp.success) {
        let codeText = LocalAIApi.extractText(resp);
        
        // Clean up code (remove markdown code blocks if present)
        const codeBlockPatterns = [
          /```python\n?/g,
          /```matlab\n?/g,
          /```m\n?/g,
          /```r\n?/g,
          /```julia\n?/g,
          /```jl\n?/g,
          /```octave\n?/g,
          /```gnuplot\n?/g,
          /```plt\n?/g,
          /```dot\n?/g,
          /```graphviz\n?/g,
          /```processing\n?/g,
          /```pde\n?/g,
          /```\n?/g,
        ];
        codeBlockPatterns.forEach(pattern => {
          codeText = codeText.replace(pattern, '');
        });
        codeText = codeText.trim();
        
        if (codeText) {
          const timestamp = Date.now();
          const filename = `simulation_${timestamp}${program.extension}`;
          const filepath = path.join(this.codeDir, filename);
          
          fs.writeFileSync(filepath, codeText, 'utf8');
          
          return {
            success: true,
            code: codeText,
            filename: filename,
            filepath: filepath,
            program: programId,
            programName: program.name,
          };
        }
      }

      return {
        success: false,
        error: resp?.error || 'Failed to generate simulation code',
      };
    } catch (error) {
      console.error('Simulation code generation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Execute Python simulation
  async executePython(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.python;
      const outputFilename = `simulation_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const pythonProcess = spawn(program.cmd, [...program.args, codePath], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
        stdio: ['pipe', 'pipe', 'pipe'], // Windows에서 출력 캡처를 위해 명시적으로 설정
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python stdout:', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Python stderr:', data.toString());
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          const files = fs.readdirSync(this.outputDir);
          const videoFiles = files.filter(f => 
            f.endsWith('.mp4') || f.endsWith('.gif') || f.endsWith('.avi')
          );
          
          if (videoFiles.length > 0) {
            const latestFile = videoFiles.sort().reverse()[0];
            resolve({
              success: true,
              outputFile: latestFile,
              outputPath: path.join(this.outputDir, latestFile),
              url: `/outputs/simulations/${latestFile}`,
              stdout: stdout,
            });
          } else {
            resolve({
              success: false,
              error: 'No output file generated',
              stdout: stdout,
              stderr: stderr,
            });
          }
        } else {
          resolve({
            success: false,
            error: `Python process exited with code ${code}`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          error: 'Simulation execution timeout',
        });
      }, 5 * 60 * 1000);
    });
  }

  // Execute MATLAB simulation
  async executeMATLAB(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.matlab;
      const outputFilename = `simulation_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      // MATLAB batch mode: matlab -batch "run('script.m')"
      const scriptName = path.basename(codePath, '.m');
      const matlabCommand = `try; cd('${path.dirname(codePath).replace(/\\/g, '/')}'); run('${scriptName}'); catch ME; disp(ME.message); end; exit;`;
      
      const matlabProcess = spawn(program.cmd, [
        ...program.args,
        matlabCommand
      ], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      matlabProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('MATLAB stdout:', data.toString());
      });

      matlabProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('MATLAB stderr:', data.toString());
      });

      matlabProcess.on('close', (code) => {
        // MATLAB may return non-zero even on success, so check for output files
        const files = fs.readdirSync(this.outputDir);
        const videoFiles = files.filter(f => 
          f.endsWith('.mp4') || f.endsWith('.avi') || f.endsWith('.mov')
        );
        
        if (videoFiles.length > 0) {
          const latestFile = videoFiles.sort().reverse()[0];
          resolve({
            success: true,
            outputFile: latestFile,
            outputPath: path.join(this.outputDir, latestFile),
            url: `/outputs/simulations/${latestFile}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `MATLAB process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        matlabProcess.kill();
        resolve({
          success: false,
          error: 'MATLAB execution timeout',
        });
      }, 10 * 60 * 1000); // MATLAB can take longer
    });
  }

  // Execute Blender simulation
  async executeBlender(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.blender;
      const timestamp = Date.now();
      const outputFilename = `simulation_${timestamp}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      const outputDir = path.dirname(outputPath);
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Normalize path for Blender (use forward slashes)
      const normalizedOutputPath = outputPath.replace(/\\/g, '/');
      const normalizedCodePath = codePath.replace(/\\/g, '/');
      
      // Blender headless mode with optimized settings
      // --no-window-focus: Don't steal focus
      // --no-sound: Disable sound (faster)
      // --disable-autoexec: Skip startup scripts (faster)
      const blenderProcess = spawn(program.cmd, [
        '--background',           // Headless mode
        '--no-window-focus',      // Don't steal focus
        '--no-sound',             // Disable sound
        '--disable-autoexec',     // Skip startup scripts
        '--python', normalizedCodePath,
        '--render-output', normalizedOutputPath,
        '--render-format', 'FFMPEG',
        '--render-anim'
      ], {
        cwd: path.dirname(codePath),
        env: { 
          ...process.env, 
          OUTPUT_PATH: normalizedOutputPath,
          BLENDER_OUTPUT_PATH: normalizedOutputPath  // Additional env var for code
        },
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;
      let renderProgress = '';

      // Track render progress
      blenderProcess.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        
        // Extract render progress if available
        const progressMatch = text.match(/Fra:(\d+)/);
        if (progressMatch) {
          renderProgress = `Rendering frame ${progressMatch[1]}`;
          console.log(`[Blender] ${renderProgress}`);
        } else {
          console.log('[Blender stdout]:', text.trim());
        }
      });

      blenderProcess.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        
        // Filter out common Blender warnings that aren't errors
        if (!text.includes('AL lib:') && !text.includes('OpenAL')) {
          console.error('[Blender stderr]:', text.trim());
        }
      });

      // Safe resolve wrapper to prevent double resolution
      let timeoutId;
      const safeResolve = (result) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(result);
      };

      blenderProcess.on('close', (code) => {
        if (resolved) return;
        
        // First, check if the expected output file exists
        if (fs.existsSync(outputPath)) {
          safeResolve({
            success: true,
            outputFile: outputFilename,
            outputPath: outputPath,
            url: `/outputs/simulations/${outputFilename}`,
            stdout: stdout,
            renderProgress: renderProgress,
          });
          return;
        }
        
        // If expected file doesn't exist, search for any video files created around this time
        const files = fs.readdirSync(this.outputDir);
        const videoFiles = files
          .filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.mp4', '.avi', '.mov', '.mkv'].includes(ext);
          })
          .map(f => {
            const filePath = path.join(this.outputDir, f);
            const stats = fs.statSync(filePath);
            return {
              name: f,
              path: filePath,
              time: stats.mtime.getTime(),
              size: stats.size
            };
          })
          .filter(f => {
            // Only consider files created around the same time (within 10 seconds)
            const timeDiff = Math.abs(f.time - timestamp);
            return timeDiff < 10000 && f.size > 0; // File must have content
          })
          .sort((a, b) => b.time - a.time); // Most recent first
        
        if (videoFiles.length > 0) {
          const latestFile = videoFiles[0];
          safeResolve({
            success: true,
            outputFile: latestFile.name,
            outputPath: latestFile.path,
            url: `/outputs/simulations/${latestFile.name}`,
            stdout: stdout,
            renderProgress: renderProgress,
            note: 'Output file found with different name',
          });
        } else {
          safeResolve({
            success: false,
            error: `Blender process exited with code ${code}. No output file generated.`,
            stdout: stdout.substring(0, 2000), // Limit stdout size
            stderr: stderr.substring(0, 2000), // Limit stderr size
            exitCode: code,
            renderProgress: renderProgress,
          });
        }
      });

      blenderProcess.on('error', (error) => {
        safeResolve({
          success: false,
          error: `Failed to start Blender: ${error.message}`,
          stderr: stderr,
        });
      });

      // Timeout handling with cleanup
      timeoutId = setTimeout(() => {
        if (resolved) return;
        
        console.warn('[Blender] Execution timeout, terminating process...');
        blenderProcess.kill('SIGTERM');
        
        // Give it a moment to clean up
        setTimeout(() => {
          if (!blenderProcess.killed) {
            blenderProcess.kill('SIGKILL');
          }
          
          if (!resolved) {
            safeResolve({
              success: false,
              error: 'Blender execution timeout (15 minutes). The rendering may still be in progress.',
              stdout: stdout.substring(0, 2000),
              stderr: stderr.substring(0, 2000),
              renderProgress: renderProgress,
              suggestion: 'Try increasing the timeout or optimizing the Blender scene.',
            });
          }
        }, 5000);
      }, 15 * 60 * 1000); // 15 minutes timeout
    });
  }

  // Execute R simulation
  async executeR(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.r;
      const outputFilename = `simulation_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const rProcess = spawn(program.cmd, [codePath], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      rProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('R stdout:', data.toString());
      });

      rProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('R stderr:', data.toString());
      });

      rProcess.on('close', (code) => {
        const files = fs.readdirSync(this.outputDir);
        const videoFiles = files.filter(f => 
          f.endsWith('.mp4') || f.endsWith('.gif') || f.endsWith('.avi')
        );
        
        if (videoFiles.length > 0) {
          const latestFile = videoFiles.sort().reverse()[0];
          resolve({
            success: true,
            outputFile: latestFile,
            outputPath: path.join(this.outputDir, latestFile),
            url: `/outputs/simulations/${latestFile}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `R process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        rProcess.kill();
        resolve({
          success: false,
          error: 'R execution timeout',
        });
      }, 5 * 60 * 1000);
    });
  }

  // Execute Julia simulation
  async executeJulia(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.julia;
      const outputFilename = `simulation_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const juliaProcess = spawn(program.cmd, [codePath], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      juliaProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Julia stdout:', data.toString());
      });

      juliaProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Julia stderr:', data.toString());
      });

      juliaProcess.on('close', (code) => {
        const files = fs.readdirSync(this.outputDir);
        const videoFiles = files.filter(f => 
          f.endsWith('.mp4') || f.endsWith('.gif') || f.endsWith('.avi')
        );
        
        if (videoFiles.length > 0) {
          const latestFile = videoFiles.sort().reverse()[0];
          resolve({
            success: true,
            outputFile: latestFile,
            outputPath: path.join(this.outputDir, latestFile),
            url: `/outputs/simulations/${latestFile}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Julia process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        juliaProcess.kill();
        resolve({
          success: false,
          error: 'Julia execution timeout',
        });
      }, 5 * 60 * 1000);
    });
  }

  // Execute Octave simulation
  async executeOctave(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.octave;
      const outputFilename = `simulation_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const scriptName = path.basename(codePath);
      const octaveCommand = `run('${scriptName}')`;
      
      const octaveProcess = spawn(program.cmd, [
        ...program.args,
        '--eval', octaveCommand
      ], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      octaveProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Octave stdout:', data.toString());
      });

      octaveProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Octave stderr:', data.toString());
      });

      octaveProcess.on('close', (code) => {
        const files = fs.readdirSync(this.outputDir);
        const videoFiles = files.filter(f => 
          f.endsWith('.mp4') || f.endsWith('.gif') || f.endsWith('.avi')
        );
        
        if (videoFiles.length > 0) {
          const latestFile = videoFiles.sort().reverse()[0];
          resolve({
            success: true,
            outputFile: latestFile,
            outputPath: path.join(this.outputDir, latestFile),
            url: `/outputs/simulations/${latestFile}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Octave process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        octaveProcess.kill();
        resolve({
          success: false,
          error: 'Octave execution timeout',
        });
      }, 5 * 60 * 1000);
    });
  }

  // Execute Gnuplot simulation
  async executeGnuplot(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.gnuplot;
      const outputFilename = `simulation_${Date.now()}.gif`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const gnuplotProcess = spawn(program.cmd, ['-c', codePath], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      gnuplotProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Gnuplot stdout:', data.toString());
      });

      gnuplotProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Gnuplot stderr:', data.toString());
      });

      gnuplotProcess.on('close', (code) => {
        const files = fs.readdirSync(this.outputDir);
        const outputFiles = files.filter(f => 
          f.endsWith('.gif') || f.endsWith('.png') || f.endsWith('.mp4')
        );
        
        if (outputFiles.length > 0) {
          const latestFile = outputFiles.sort().reverse()[0];
          resolve({
            success: true,
            outputFile: latestFile,
            outputPath: path.join(this.outputDir, latestFile),
            url: `/outputs/simulations/${latestFile}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Gnuplot process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        gnuplotProcess.kill();
        resolve({
          success: false,
          error: 'Gnuplot execution timeout',
        });
      }, 5 * 60 * 1000);
    });
  }

  // Execute Graphviz simulation
  async executeGraphviz(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.graphviz;
      const outputFilename = `simulation_${Date.now()}.png`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const graphvizProcess = spawn(program.cmd, [
        '-Tpng',
        '-o', outputPath,
        codePath
      ], {
        cwd: path.dirname(codePath),
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      graphvizProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Graphviz stdout:', data.toString());
      });

      graphvizProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Graphviz stderr:', data.toString());
      });

      graphvizProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve({
            success: true,
            outputFile: outputFilename,
            outputPath: outputPath,
            url: `/outputs/simulations/${outputFilename}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Graphviz process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        graphvizProcess.kill();
        resolve({
          success: false,
          error: 'Graphviz execution timeout',
        });
      }, 2 * 60 * 1000);
    });
  }

  // Execute Processing simulation
  async executeProcessing(codePath, options = {}) {
    return new Promise((resolve) => {
      const program = this.programs.processing;
      const outputFilename = `simulation_${Date.now()}.mp4`;
      const outputPath = path.join(this.outputDir, outputFilename);
      
      const sketchDir = path.dirname(codePath);
      const processingProcess = spawn(program.cmd, [
        '--sketch=' + sketchDir,
        '--run'
      ], {
        cwd: sketchDir,
        env: { ...process.env, OUTPUT_PATH: outputPath },
      });

      let stdout = '';
      let stderr = '';

      processingProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Processing stdout:', data.toString());
      });

      processingProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Processing stderr:', data.toString());
      });

      processingProcess.on('close', (code) => {
        const files = fs.readdirSync(this.outputDir);
        const videoFiles = files.filter(f => 
          f.endsWith('.mp4') || f.endsWith('.gif') || f.endsWith('.avi')
        );
        
        if (videoFiles.length > 0) {
          const latestFile = videoFiles.sort().reverse()[0];
          resolve({
            success: true,
            outputFile: latestFile,
            outputPath: path.join(this.outputDir, latestFile),
            url: `/outputs/simulations/${latestFile}`,
            stdout: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Processing process exited with code ${code}. No output file generated.`,
            stdout: stdout,
            stderr: stderr,
          });
        }
      });

      setTimeout(() => {
        processingProcess.kill();
        resolve({
          success: false,
          error: 'Processing execution timeout',
        });
      }, 5 * 60 * 1000);
    });
  }

  // Execute simulation via MCP
  async executeSimulationViaMCP(codePath, programId, options = {}) {
    const code = fs.readFileSync(codePath, 'utf8');
    
    // Program to MCP connection mapping
    const mcpMap = {
      python: pythonMCP,
      matlab: matlabMCP,
      octave: octaveMCP, // GNU Octave (MATLAB 대체)
      manim: manimMCP,
    };
    
    const mcpConnection = mcpMap[programId];
    if (!mcpConnection) {
      throw new Error(`No MCP connection configured for ${programId}`);
    }
    
    console.log(`[SimulationRunner] Using MCP for ${programId} via ${mcpConnection.config.endpoint}`);
    
    // Execute via MCP
    const result = await mcpConnection.executeCommand('execute', {
      code: code,
      options: options
    });
    
    return result;
  }

  // Main execution method - routes to appropriate executor
  async executeSimulation(codePath, programId, options = {}) {
    // Check if MCP mode is enabled
    const useMCP = process.env.USE_MCP_SIMULATION === 'true' || options.useMCP === true;
    
    // MCP supported programs
    const mcpSupportedPrograms = ['python', 'matlab', 'octave', 'manim'];
    
    // Use MCP if enabled and program is supported
    if (useMCP && mcpSupportedPrograms.includes(programId)) {
      try {
        return await this.executeSimulationViaMCP(codePath, programId, options);
      } catch (error) {
        console.error(`[SimulationRunner] MCP execution failed for ${programId}:`, error.message);
        console.log(`[SimulationRunner] Falling back to local execution`);
        // Fall through to local execution
      }
    }
    
    // Local execution (default)
    switch (programId) {
      case 'matlab':
        return this.executeMATLAB(codePath, options);
      case 'r':
        return this.executeR(codePath, options);
      case 'julia':
        return this.executeJulia(codePath, options);
      case 'octave':
        return this.executeOctave(codePath, options);
      case 'gnuplot':
        return this.executeGnuplot(codePath, options);
      case 'graphviz':
        return this.executeGraphviz(codePath, options);
      case 'processing':
        return this.executeProcessing(codePath, options);
      case 'python':
      default:
        return this.executePython(codePath, options);
    }
  }

  // Main method: generate code and run simulation
  async generateAndRun(conversationHistory, options = {}) {
    // Step 1: Detect or use specified program
    const programId = options.program || this.detectProgram(conversationHistory);
    
    // Step 2: Generate code
    const codeResult = await this.generateSimulationCode(conversationHistory, programId, options);
    
    if (!codeResult.success) {
      return codeResult;
    }

    // Step 3: Execute code
    const execResult = await this.executeSimulation(codeResult.filepath, programId, options);
    
    return {
      ...execResult,
      code: codeResult.code,
      codeFile: codeResult.filename,
      program: programId,
      programName: codeResult.programName,
    };
  }

  // Get available programs
  getAvailablePrograms() {
    const available = [];
    for (const [id, config] of Object.entries(this.programs)) {
      // Check if program is available
      try {
        const testProcess = spawn(config.cmd, ['--version'], { stdio: 'ignore' });
        testProcess.on('error', () => {
          // Program not found
        });
        available.push({
          id,
          name: config.name,
          available: true, // Simplified check
        });
      } catch {
        available.push({
          id,
          name: config.name,
          available: false,
        });
      }
    }
    return available;
  }
}

module.exports = new SimulationRunner();
