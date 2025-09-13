# 🐳 UTERNITY Docker Setup Guide

Welcome to UTERNITY! This guide will help you and your intern get the project running with Docker in minutes.

## 🚀 Quick Start (For Your Intern)

### Step 1: Prerequisites
```bash
# Install Docker Desktop from: https://www.docker.com/products/docker-desktop/
# Or on Mac with Homebrew:
brew install --cask docker
```

### Step 2: Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd UTERNITY

# Copy environment file
cp env.development .env

# Edit .env file with your API keys
nano .env  # or use any text editor
```

### Step 3: Get Your API Keys
1. **Groq API Key** (Required):
   - Go to: https://console.groq.com/
   - Sign up/login and get your API key
   - Add it to `.env` file: `GROQ_API_KEY=your_actual_key_here`

2. **OpenAI API Key** (Optional fallback):
   - Go to: https://platform.openai.com/api-keys
   - Get your API key
   - Add it to `.env` file: `OPENAI_API_KEY=your_actual_key_here`

### Step 4: Run the Application
```bash
# Start the simple development environment
docker-compose -f docker-compose.simple.yml up --build

# Or run in background
docker-compose -f docker-compose.simple.yml up -d --build
```

### Step 5: Test It Works
- Open: http://localhost:8013/health
- You should see: `{"status": "healthy", ...}`
- Chat endpoint: http://localhost:8013/chat

## 🛠️ Development Workflow

### Making Changes
```bash
# Your code changes are automatically reflected (volume mounting)
# Just save your files and the container will reload

# View logs
docker-compose -f docker-compose.simple.yml logs -f uternity-chat

# Stop services
docker-compose -f docker-compose.simple.yml down
```

### Useful Commands
```bash
# Rebuild after dependency changes
docker-compose -f docker-compose.simple.yml up --build

# Run shell inside container
docker-compose -f docker-compose.simple.yml exec uternity-chat bash

# View all running containers
docker ps

# Clean up everything
docker-compose -f docker-compose.simple.yml down -v
docker system prune -f
```

## 🏗️ Architecture Overview

### Simple Setup (Recommended for starting)
- **uternity-chat**: Main FastAPI application
- **redis**: Caching (optional)
- **postgres**: Database (optional)

### Full Microservices Setup
Use `docker-compose.yml` for the complete system with:
- API Gateway
- Voice Agent
- University Recommender
- SOP Assistant
- Community Platform
- Vector Database (Qdrant)
- Ollama LLM Server

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Kill process on port 8013
   lsof -ti:8013 | xargs kill -9
   ```

2. **Permission denied**:
   ```bash
   # Fix Docker permissions (Linux/Mac)
   sudo chmod 666 /var/run/docker.sock
   ```

3. **API key not working**:
   - Make sure `.env` file is in the root directory
   - Check that API key is valid and has credits
   - Restart containers after changing `.env`

4. **Container won't start**:
   ```bash
   # Check logs
   docker-compose -f docker-compose.simple.yml logs uternity-chat
   
   # Rebuild from scratch
   docker-compose -f docker-compose.simple.yml down -v
   docker-compose -f docker-compose.simple.yml up --build
   ```

### Getting Help
- Check container logs: `docker-compose logs <service-name>`
- Verify environment variables: `docker-compose config`
- Test API directly: `curl http://localhost:8013/health`

## 📚 Next Steps

1. **Start Simple**: Use `docker-compose.simple.yml` first
2. **Learn the Codebase**: Explore `simple_chat_service.py`
3. **Add Features**: Modify the chat service
4. **Scale Up**: Move to full `docker-compose.yml` when ready
5. **Deploy**: Use production configurations

## 🤝 Collaboration Tips

### For the Intern:
- Always pull latest changes: `git pull origin main`
- Create feature branches: `git checkout -b feature/your-feature`
- Test locally before pushing
- Use the simple setup until comfortable

### For Code Reviews:
- Changes are reflected immediately with volume mounting
- Use `docker-compose logs` to debug together
- Share the same `.env` file for consistency

Happy coding! 🚀
