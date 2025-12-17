#!/bin/bash

# Chat Application - Production Build Script
# This script prepares the application for deployment

set -e  # Exit on error

echo "🚀 Chat Application - Production Build"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

print_success "Node.js $(node --version) detected"

# Ask what to build
echo ""
echo "What would you like to build?"
echo "1) Server only"
echo "2) Desktop app only"
echo "3) Both server and desktop app"
read -p "Enter your choice (1-3): " choice

# Get production server URL
if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo ""
    read -p "Enter your production server URL (e.g., https://api.yourdomain.com): " SERVER_URL
    
    if [ -z "$SERVER_URL" ]; then
        print_error "Server URL is required for desktop app build"
        exit 1
    fi
fi

# Build Server
if [ "$choice" = "1" ] || [ "$choice" = "3" ]; then
    echo ""
    echo "📦 Building Server..."
    echo "-------------------"
    
    cd packages/server
    
    # Install dependencies
    print_info "Installing server dependencies..."
    npm install --production
    print_success "Server dependencies installed"
    
    # Check for .env file
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating template..."
        cat > .env << EOF
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=CHANGE-THIS-TO-A-SECURE-RANDOM-STRING
CORS_ORIGIN=https://yourdomain.com
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
EOF
        print_warning "Please update .env file with your production values!"
    else
        print_success ".env file found"
    fi
    
    cd ../..
    print_success "Server build complete"
fi

# Build Desktop App
if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo ""
    echo "🖥️  Building Desktop App..."
    echo "-------------------------"
    
    # Update API URLs
    print_info "Updating API URLs to production..."
    
    # Backup original files
    cp packages/shared/api.js packages/shared/api.js.backup
    cp packages/shared/hooks/useSocket.js packages/shared/hooks/useSocket.js.backup
    
    # Update api.js
    sed -i.bak "s|http://localhost:5000/api|${SERVER_URL}/api|g" packages/shared/api.js
    
    # Update useSocket.js
    sed -i.bak "s|http://localhost:5000|${SERVER_URL}|g" packages/shared/hooks/useSocket.js
    
    print_success "API URLs updated"
    
    # Install dependencies
    cd packages/desktop
    print_info "Installing desktop app dependencies..."
    npm install
    print_success "Desktop app dependencies installed"
    
    # Build
    print_info "Building desktop application (this may take a few minutes)..."
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Desktop app build complete!"
        echo ""
        print_info "Built files are in: packages/desktop/dist/"
        ls -lh dist/ | grep -E '\.(exe|dmg|AppImage)$' || true
    else
        print_error "Desktop app build failed"
        cd ../..
        # Restore backups
        mv packages/shared/api.js.backup packages/shared/api.js
        mv packages/shared/hooks/useSocket.js.backup packages/shared/hooks/useSocket.js
        exit 1
    fi
    
    cd ../..
    
    # Ask if user wants to restore localhost URLs
    echo ""
    read -p "Restore localhost URLs for development? (y/n): " restore
    if [ "$restore" = "y" ]; then
        mv packages/shared/api.js.backup packages/shared/api.js
        mv packages/shared/hooks/useSocket.js.backup packages/shared/hooks/useSocket.js
        rm -f packages/shared/api.js.bak packages/shared/hooks/useSocket.js.bak
        print_success "Localhost URLs restored"
    else
        rm -f packages/shared/api.js.backup packages/shared/hooks/useSocket.js.backup
        rm -f packages/shared/api.js.bak packages/shared/hooks/useSocket.js.bak
        print_info "Production URLs kept"
    fi
fi

# Summary
echo ""
echo "======================================"
echo "🎉 Build Complete!"
echo "======================================"
echo ""

if [ "$choice" = "1" ] || [ "$choice" = "3" ]; then
    echo "📦 Server:"
    echo "   - Location: packages/server/"
    echo "   - Start: cd packages/server && npm start"
    echo "   - Don't forget to configure .env file!"
    echo ""
fi

if [ "$choice" = "2" ] || [ "$choice" = "3" ]; then
    echo "🖥️  Desktop App:"
    echo "   - Location: packages/desktop/dist/"
    echo "   - Installers ready for distribution"
    echo ""
fi

echo "📖 For detailed deployment instructions, see DEPLOYMENT.md"
echo ""

print_success "All done! 🚀"
