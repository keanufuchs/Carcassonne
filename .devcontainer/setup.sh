#!/usr/bin/env bash

set -e

echo "Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

echo "Installing Claude Code Router..."
npm install -g @musistudio/claude-code-router

mkdir -p ~/.claude-code-router

cat > ~/.claude-code-router/config.json << 'EOF'
{
  "LOG": true,
  "API_TIMEOUT_MS": 600000,

  "Providers": [
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "${OPENROUTER_API_KEY}",
      "models": [
        "deepseek/deepseek-v4-pro",
        "deepseek/deepseek-v4-flash",
        "google/gemini-3.5-flash"
      ],
      "transformer": {
        "use": ["openrouter"]
      }
    }
  ],

  "Router": {
    "default": "openrouter,deepseek/deepseek-v4-pro",
    "background": "openrouter,deepseek/deepseek-v4-flash",
    "think": "openrouter,deepseek/deepseek-v4-pro",
    "longContext": "openrouter,google/gemini-3.5-flash",
    "webSearch": "openrouter,google/gemini-3.5-flash"
  }
}
EOF

echo "Setup complete."