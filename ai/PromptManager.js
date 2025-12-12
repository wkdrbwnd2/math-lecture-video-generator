// Prompt Manager - Manages system prompts for each AI tool
// Allows customization and learning from user interactions

const fs = require('fs');
const path = require('path');

class PromptManager {
  constructor() {
    this.promptsPath = path.join(__dirname, '..', 'config', 'prompts.json');
    this.prompts = this.loadPrompts();
  }

  loadPrompts() {
    try {
      if (fs.existsSync(this.promptsPath)) {
        const data = fs.readFileSync(this.promptsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
    // Return default prompts if file doesn't exist
    return this.getDefaultPrompts();
  }

  savePrompts() {
    try {
      const dir = path.dirname(this.promptsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.promptsPath, JSON.stringify(this.prompts, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving prompts:', error);
      return false;
    }
  }

  getSystemPrompt(toolName) {
    return this.prompts[toolName]?.systemPrompt || '';
  }

  getGenerationPrompt(toolName) {
    return this.prompts[toolName]?.generationPrompt || '';
  }

  updateSystemPrompt(toolName, newPrompt) {
    if (!this.prompts[toolName]) {
      this.prompts[toolName] = {};
    }
    this.prompts[toolName].systemPrompt = newPrompt;
    return this.savePrompts();
  }

  updateGenerationPrompt(toolName, newPrompt) {
    if (!this.prompts[toolName]) {
      this.prompts[toolName] = {};
    }
    this.prompts[toolName].generationPrompt = newPrompt;
    return this.savePrompts();
  }

  getDefaultPrompts() {
    return {
      simulation: {
        systemPrompt: "You are an AI assistant specialized in creating and configuring simulations for educational videos.\nYour goal is to help users design simulations that effectively demonstrate concepts.\nEvaluate the user's requirements and ask questions about:\n- What concept or phenomenon needs to be simulated\n- What parameters or variables should be adjustable\n- What visualizations or outputs are needed\n- What educational goals the simulation should achieve\nBe conversational, helpful, and ask specific questions to refine the simulation design.",
        generationPrompt: "Based on the conversation history, create a detailed simulation specification with Python code."
      },
      script: {
        systemPrompt: "You are an AI assistant specialized in writing educational video scripts.\nYour goal is to help users create clear, engaging, and educational scripts.\nEvaluate the user's requirements and ask questions about:\n- The topic and target audience\n- Video length and format preferences\n- Key points or learning objectives\n- Tone and style preferences\n- Visual elements or demonstrations needed\nBe conversational, helpful, and ask questions to create the best possible script.",
        generationPrompt: "Based on the conversation history, create a complete educational video script."
      },
      video: {
        systemPrompt: "You are an AI assistant specialized in video generation and production.\nYour goal is to help users create complete educational videos by coordinating scripts, simulations, and visual elements.\nEvaluate the user's requirements and ask questions about:\n- Available scripts and simulation outputs\n- Video style and visual preferences\n- Narration and voice-over needs\n- Editing and post-production requirements\n- Final output format and distribution needs\nBe conversational, helpful, and ask questions to ensure all elements come together perfectly.",
        generationPrompt: "Based on the conversation history and available resources, create a video production plan."
      }
    };
  }
}

module.exports = new PromptManager();

