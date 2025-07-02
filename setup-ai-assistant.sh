#!/bin/bash

# AI Assistant Setup Script
echo "🤖 Setting up AI Data Analysis Assistant..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Check if OpenAI API key is set
if grep -q "your_openai_api_key_here" .env 2>/dev/null; then
    echo ""
    echo "⚠️  IMPORTANT: You need to set your OpenAI API key!"
    echo "   1. Get an API key from: https://platform.openai.com/api-keys"
    echo "   2. Edit .env file and replace 'your_openai_api_key_here' with your actual key"
    echo "   3. Restart your development server"
    echo ""
else
    echo "✅ OpenAI API key appears to be configured"
fi

# Check if openai package is installed
if npm list openai > /dev/null 2>&1; then
    echo "✅ OpenAI package is installed"
else
    echo "📦 Installing OpenAI package..."
    npm install openai
    echo "✅ OpenAI package installed"
fi

echo ""
echo "🎉 Setup complete! Your AI assistant is ready to use."
echo ""
echo "💡 Tips:"
echo "   • The AI button appears in the dashboard header when you have data"
echo "   • There's also a floating button in the bottom-right corner"
echo "   • The assistant analyzes all your current dashboard data"
echo "   • Try the quick questions for instant insights"
echo ""
