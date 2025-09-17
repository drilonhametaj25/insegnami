#!/bin/bash

# InsegnaMi.pro Development Environment Setup

echo "🚀 Starting InsegnaMi.pro Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start Docker services (PostgreSQL, Redis, MailHog)
echo "🐳 Starting Docker services..."
cd docker
docker-compose up -d postgres redis mailhog

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

cd ..

# Run Prisma migrations
echo "🗄️ Setting up database..."
npm run db:push

# Seed the database
echo "🌱 Seeding database with sample data..."
npm run db:seed

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "🌐 Services:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379" 
echo "  - MailHog UI: http://localhost:8025"
echo ""
echo "👥 Available login accounts (password: 'password'):"
echo "  📧 Admin: admin@englishplus.it"
echo "  🏫 Teacher: teacher1@englishplus.it, teacher2@englishplus.it"
echo "  🎓 Student: student@englishplus.it"
echo "  👨‍👩‍👧‍👦 Parent: parent@englishplus.it"
echo ""
echo "🚀 To start the development server:"
echo "  npm run dev"
echo ""
echo "📱 The application will be available at: http://localhost:3000"
