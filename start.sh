#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       AI Video Testimonial Creator - Startup Script          ║${NC}"
echo -e "${BLUE}║                    Full Feature Edition                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to kill process on port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}  Killing processes on port $port (PIDs: $(echo $pids | tr '\n' ' '))${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null
    fi
}

# Step 1: Clean up ports
echo -e "${CYAN}Step 1: Cleaning up ports...${NC}"
# Kill any leftover nodemon/node server processes
pkill -9 -f "nodemon server.js" 2>/dev/null
pkill -9 -f "node server.js" 2>/dev/null
sleep 1
kill_port 3000
kill_port 3001
kill_port 3002
kill_port 3003
sleep 2
# Verify ports are actually free
for port in 3000 3001; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}  Port $port still in use, retrying...${NC}"
        lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null
        sleep 2
    fi
done
echo -e "${GREEN}  ✓ Ports 3000, 3001 cleaned${NC}"
echo ""

# Step 2: Check PostgreSQL
echo -e "${CYAN}Step 2: Checking PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}  ✗ PostgreSQL is not installed. Please install it first.${NC}"
    echo -e "${YELLOW}    macOS: brew install postgresql@14 && brew services start postgresql@14${NC}"
    exit 1
fi

# Try to start PostgreSQL if not running
if ! pg_isready -q 2>/dev/null; then
    echo -e "${YELLOW}  Starting PostgreSQL...${NC}"
    if command -v brew &> /dev/null; then
        brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null
    fi
    sleep 3
fi

if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}  ✓ PostgreSQL is running${NC}"
else
    echo -e "${RED}  ✗ PostgreSQL is not running. Please start it manually.${NC}"
    exit 1
fi
echo ""

# Step 3: Create database if not exists
echo -e "${CYAN}Step 3: Setting up database...${NC}"
DB_NAME="video_testimonials"
DB_USER="postgres"

# Check if database exists
if psql -U $DB_USER -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${YELLOW}  Database '$DB_NAME' already exists${NC}"
else
    echo -e "${YELLOW}  Creating database '$DB_NAME'...${NC}"
    createdb -U $DB_USER $DB_NAME 2>/dev/null || psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Database created${NC}"
    else
        echo -e "${YELLOW}  Trying with default user...${NC}"
        createdb $DB_NAME 2>/dev/null
    fi
fi
echo ""

# Step 4: Verify .env file exists
echo -e "${CYAN}Step 4: Checking environment configuration...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}  ✓ .env file found${NC}"
    # Check for required variables
    if grep -q "OPENROUTER_API_KEY" .env; then
        echo -e "${GREEN}  ✓ OpenRouter API key configured${NC}"
    else
        echo -e "${YELLOW}  ⚠ OpenRouter API key not found in .env${NC}"
    fi
    if grep -q "OPENROUTER_MODEL" .env; then
        MODEL=$(grep "OPENROUTER_MODEL" .env | cut -d '=' -f2 | tr -d '"')
        echo -e "${GREEN}  ✓ Model: $MODEL${NC}"
    fi
else
    echo -e "${RED}  ✗ .env file not found!${NC}"
    exit 1
fi
echo ""

# Step 5: Install backend dependencies
echo -e "${CYAN}Step 5: Installing backend dependencies...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  Installing packages...${NC}"
    npm install
else
    echo -e "${YELLOW}  Checking for updates...${NC}"
    npm install --silent 2>/dev/null
fi
echo -e "${GREEN}  ✓ Backend dependencies ready${NC}"
echo ""

# Step 6: Install frontend dependencies
echo -e "${CYAN}Step 6: Installing frontend dependencies...${NC}"
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  Installing packages...${NC}"
    npm install
else
    echo -e "${YELLOW}  Checking for updates...${NC}"
    npm install --silent 2>/dev/null
fi
echo -e "${GREEN}  ✓ Frontend dependencies ready${NC}"
echo ""

# Step 7: Seed the database
echo -e "${CYAN}Step 7: Seeding database with sample data...${NC}"
cd ../backend
node seed.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Database seeded successfully${NC}"
    echo -e "${GREEN}    - 16 Reviews${NC}"
    echo -e "${GREEN}    - 16 Avatars${NC}"
    echo -e "${GREEN}    - 16 Templates${NC}"
    echo -e "${GREEN}    - 16 Scripts${NC}"
    echo -e "${GREEN}    - 16 Voiceovers${NC}"
    echo -e "${GREEN}    - 16 Videos${NC}"
    echo -e "${GREEN}    - 16 Interview Questions${NC}"
    echo -e "${GREEN}    - 16 Sports Highlights${NC}"
    echo -e "${GREEN}    - 16 General Highlights${NC}"
    echo -e "${GREEN}    - 16 B-Roll Suggestions${NC}"
    echo -e "${GREEN}    - 16 Music Matches${NC}"
    echo -e "${GREEN}    - 16 Transcripts${NC}"
else
    echo -e "${RED}  ⚠ Database seeding had issues${NC}"
fi
echo ""

# Step 8: Start servers with hot reload
echo -e "${CYAN}Step 8: Starting servers with hot reload...${NC}"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Starting Backend on port 3001 (with nodemon hot reload)${NC}"
echo -e "${GREEN}  Starting Frontend on port 3000 (with React hot reload)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}  Backend API:  ${CYAN}http://localhost:3001${NC}"
echo -e "${YELLOW}  Frontend App: ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Demo Login Credentials:                                     ║${NC}"
echo -e "${GREEN}║    Email:    demo@example.com                                ║${NC}"
echo -e "${GREEN}║    Password: password123                                     ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  Click 'Auto-fill Demo Credentials' on login page!           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Features Available:${NC}"
echo -e "  ${YELLOW}Core:${NC} Reviews, Scripts, Videos, Avatars, Templates, Voiceovers"
echo -e "  ${YELLOW}AI:${NC}   Interview Questions, Sports Highlights, Highlights,"
echo -e "        B-Roll Suggester, Music Matcher, Transcript Generator"
echo -e "  ${YELLOW}Tools:${NC} 16 AI-powered tools via OpenRouter"
echo ""
echo -e "${BLUE}Code changes will automatically reload (hot reload enabled)${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill_port 3000
    kill_port 3001
    # Kill any remaining node processes from this script
    pkill -P $$ 2>/dev/null
    echo -e "${GREEN}✓ All servers stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend with nodemon (hot reload)
cd ../backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend (React with hot reload built-in)
cd ../frontend
BROWSER=none npm start &
FRONTEND_PID=$!

# Monitor for code changes message
echo -e "${GREEN}✓ Servers started! Watching for changes...${NC}"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
