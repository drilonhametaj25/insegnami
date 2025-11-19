# InsegnaMi.pro Quick Start Script for Windows
# This script sets up the entire development environment with one command

Write-Host "🚀 InsegnaMi.pro Quick Start" -ForegroundColor Green
Write-Host "===============================`n" -ForegroundColor Green

# Check if Docker is running
Write-Host "🔍 Checking Docker..." -ForegroundColor Cyan
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Write-Host "   After starting Docker, run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Node.js is available
Write-Host "🔍 Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js is available: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green

# Start Docker services
Write-Host "`n🐳 Starting Docker services..." -ForegroundColor Cyan
Set-Location docker
docker-compose up -d postgres redis mailhog
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start Docker services" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Wait for services
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

# Setup database
Write-Host "`n🗄️ Setting up database..." -ForegroundColor Cyan
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to setup database" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database schema applied" -ForegroundColor Green

# Seed database
Write-Host "`n🌱 Seeding database..." -ForegroundColor Cyan
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database seeded with sample data" -ForegroundColor Green

Write-Host "`n" -ForegroundColor White
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Services Running:" -ForegroundColor White
Write-Host "  • PostgreSQL: localhost:5433 (dedicated to InsegnaMi)" -ForegroundColor Gray
Write-Host "  • Redis: localhost:6380 (dedicated to InsegnaMi)" -ForegroundColor Gray
Write-Host "  • MailHog UI: http://localhost:8026" -ForegroundColor Gray
Write-Host "  • MailHog SMTP: localhost:1026" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 No conflicts with other projects (PegasoWorld, etc.)" -ForegroundColor Cyan
Write-Host ""
Write-Host "👥 Login Accounts (password: 'password'):" -ForegroundColor White
Write-Host "  📧 Admin: admin@englishplus.it" -ForegroundColor Cyan
Write-Host "  🏫 Teacher: teacher@englishplus.it, teacher2@englishplus.it" -ForegroundColor Cyan
Write-Host "  🎓 Student: student@englishplus.it, giulia.romano@email.it, +4 more" -ForegroundColor Cyan
Write-Host "  👨‍👩‍👧‍👦 Parent: parent@englishplus.it, +5 more" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Sample Data Includes:" -ForegroundColor White
Write-Host "  • 3 courses (Beginner, Intermediate, Advanced Business)" -ForegroundColor Gray
Write-Host "  • 3 active classes with enrolled students" -ForegroundColor Gray
Write-Host "  • Multiple lessons with attendance tracking" -ForegroundColor Gray
Write-Host "  • Payment records with various statuses" -ForegroundColor Gray
Write-Host "  • Notices for different user roles" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 To start the development server:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "📱 The application will be available at:" -ForegroundColor White
Write-Host "  http://localhost:3000" -ForegroundColor Green
Write-Host ""

# Ask if user wants to start the dev server immediately
$response = Read-Host "Would you like to start the development server now? (y/N)"
if ($response -eq "y" -or $response -eq "Y" -or $response -eq "yes" -or $response -eq "Yes") {
    Write-Host "`n🚀 Starting development server..." -ForegroundColor Cyan
    npm run dev
}
