# InsegnaMi.pro Development Environment Setup for Windows

Write-Host "🚀 Starting InsegnaMi.pro Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Start Docker services (PostgreSQL, Redis, MailHog)
Write-Host "🐳 Starting Docker services..." -ForegroundColor Cyan
Set-Location docker
docker-compose up -d postgres redis mailhog

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Set-Location ..

# Run Prisma migrations
Write-Host "🗄️ Setting up database..." -ForegroundColor Cyan
npm run db:push

# Seed the database
Write-Host "🌱 Seeding database with sample data..." -ForegroundColor Cyan
npm run db:seed

Write-Host ""
Write-Host "✅ Development environment is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Services:" -ForegroundColor White
Write-Host "  - PostgreSQL: localhost:5432" -ForegroundColor Gray
Write-Host "  - Redis: localhost:6379" -ForegroundColor Gray
Write-Host "  - MailHog UI: http://localhost:8025" -ForegroundColor Gray
Write-Host ""
Write-Host "👥 Available login accounts (password: 'password'):" -ForegroundColor White
Write-Host "  📧 Admin: admin@englishplus.it" -ForegroundColor Cyan
Write-Host "  🏫 Teacher: teacher1@englishplus.it, teacher2@englishplus.it" -ForegroundColor Cyan
Write-Host "  🎓 Student: student@englishplus.it" -ForegroundColor Cyan
Write-Host "  👨‍👩‍👧‍👦 Parent: parent@englishplus.it" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 To start the development server:" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "📱 The application will be available at: http://localhost:3000" -ForegroundColor Green
