#!/bin/bash
# IntelliCare Nexus — Pre-Demo Health Check
# Run this before your hackathon presentation

set -e
BASE_URL="${1:-http://localhost:8000}"

echo "============================================"
echo " IntelliCare Nexus — Pre-Demo Check"
echo "============================================"
echo ""

# Check backend health
echo "1. Checking backend health..."
HEALTH=$(curl -s "$BASE_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
    echo "   Backend: HEALTHY"
else
    echo "   Backend: FAILED - start with: uvicorn app.main:app --reload"
    exit 1
fi

# Check Gemini API
echo "2. Checking Gemini API connectivity..."
GEMINI=$(curl -s "$BASE_URL/health/gemini" 2>/dev/null)
if echo "$GEMINI" | grep -q '"status":"healthy"'; then
    echo "   Gemini 2.5: CONNECTED"
else
    echo "   Gemini 2.5: FAILED - check GEMINI_API_KEY in .env"
    echo "   Response: $GEMINI"
fi

# Check demo patient exists
echo "3. Checking demo patient data..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@intellicare.ai","password":"Demo@2024"}' 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "   Demo login: FAILED - run seed_data first"
    echo "   Command: python -m app.scripts.seed_data"
else
    echo "   Demo login: OK"
    PATIENTS=$(curl -s "$BASE_URL/api/v1/patients/" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    COUNT=$(echo "$PATIENTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
    echo "   Patients in DB: $COUNT"
    if [ "$COUNT" -eq "0" ]; then
        echo "   WARNING: No patients! Run: python -m app.scripts.seed_data"
    fi
fi

# Check Redis
echo "4. Checking Redis connectivity..."
REDIS_OK=$(redis-cli -u "${REDIS_URL:-redis://localhost:6379}" ping 2>/dev/null)
if [ "$REDIS_OK" = "PONG" ]; then
    echo "   Redis: CONNECTED"
else
    echo "   Redis: FAILED - WebSocket events will not stream"
fi

echo ""
echo "============================================"
echo " Frontend check: open http://localhost:3000"
echo " Demo shortcut:  Ctrl+Shift+D"
echo " API docs:       $BASE_URL/docs"
echo "============================================"
