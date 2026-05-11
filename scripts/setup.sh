#!/bin/bash
# IntelliCare Nexus - Local Development Setup Script

set -e

echo "============================================"
echo " IntelliCare Nexus - Setup Script"
echo "============================================"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting."; exit 1; }

# Setup environment
echo ""
echo "Setting up environment configuration..."
if [ ! -f infra/.env ]; then
    cp infra/.env.example infra/.env
    echo "Created infra/.env from template"
    echo "IMPORTANT: Add your GEMINI_API_KEY to infra/.env before continuing"
    read -p "Press Enter after adding your API key..."
fi

# Start infrastructure services
echo ""
echo "Starting Docker services (PostgreSQL, Redis, ChromaDB)..."
cd infra
docker-compose up -d postgres redis chromadb
cd ..

# Wait for services
echo "Waiting for services to be ready..."
sleep 8

# Backend setup
echo ""
echo "Setting up Python backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "Running database migrations..."
cp infra/.env .env 2>/dev/null || true
python -m app.scripts.seed_data

cd ..

# Frontend setup
echo ""
echo "Setting up Next.js frontend..."
cd frontend
npm install --legacy-peer-deps --silent
cd ..

echo ""
echo "============================================"
echo " Setup Complete!"
echo "============================================"
echo ""
echo "To start the platform:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend && source venv/bin/activate"
echo "    uvicorn app.main:app --reload --port 8000"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Demo login:"
echo "  Email:    demo@intellicare.ai"
echo "  Password: Demo@2024"
echo ""
echo "Or use Docker Compose for everything:"
echo "  cd infra && docker-compose up --build"
echo ""
