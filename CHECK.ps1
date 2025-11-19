# Script di verifica ambiente InsegnaMi
# Verifica che tutto sia configurato correttamente

Write-Host ""
Write-Host "🔍 Verifica Ambiente InsegnaMi.pro" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Verifica Node.js
Write-Host "📦 Node.js..." -NoNewline
try {
    $nodeVersion = node --version
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Non installato" -ForegroundColor Red
    $allGood = $false
}

# Verifica npm
Write-Host "📦 npm..." -NoNewline
try {
    $npmVersion = npm --version
    Write-Host " ✅ v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Non installato" -ForegroundColor Red
    $allGood = $false
}

# Verifica Docker
Write-Host "🐳 Docker..." -NoNewline
try {
    docker --version | Out-Null
    Write-Host " ✅ Installato" -ForegroundColor Green
} catch {
    Write-Host " ❌ Non installato" -ForegroundColor Red
    $allGood = $false
}

# Verifica Docker in esecuzione
Write-Host "🐳 Docker Running..." -NoNewline
try {
    docker info 2>&1 | Out-Null
    Write-Host " ✅ Attivo" -ForegroundColor Green
} catch {
    Write-Host " ❌ Non in esecuzione" -ForegroundColor Red
    $allGood = $false
}

# Verifica container InsegnaMi
Write-Host ""
Write-Host "📦 Container Docker:" -ForegroundColor Yellow

$containers = @("insegnami-postgres", "insegnami-redis", "insegnami-mailhog")
foreach ($container in $containers) {
    Write-Host "   $container..." -NoNewline
    $status = docker ps --filter "name=$container" --format "{{.Status}}"
    if ($status) {
        Write-Host " ✅ $status" -ForegroundColor Green
    } else {
        Write-Host " ❌ Non in esecuzione" -ForegroundColor Red
        $allGood = $false
    }
}

# Verifica node_modules
Write-Host ""
Write-Host "📚 Dipendenze..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " ✅ Installate" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Non installate (esegui: npm install)" -ForegroundColor Yellow
    $allGood = $false
}

# Verifica .env
Write-Host "⚙️  File .env..." -NoNewline
if (Test-Path ".env") {
    Write-Host " ✅ Presente" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Mancante" -ForegroundColor Yellow
}

# Verifica .env.local
Write-Host "⚙️  File .env.local..." -NoNewline
if (Test-Path ".env.local") {
    Write-Host " ✅ Presente" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Mancante (opzionale)" -ForegroundColor Gray
}

# Test connessione PostgreSQL
Write-Host ""
Write-Host "🔗 Test Connessioni:" -ForegroundColor Yellow
Write-Host "   PostgreSQL (5433)..." -NoNewline
try {
    $testConnection = docker exec insegnami-postgres pg_isready -U insegnami_user -d insegnami_db 2>&1
    if ($testConnection -match "accepting connections") {
        Write-Host " ✅ OK" -ForegroundColor Green
    } else {
        Write-Host " ❌ Errore" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " ❌ Errore connessione" -ForegroundColor Red
    $allGood = $false
}

# Test connessione Redis
Write-Host "   Redis (6380)..." -NoNewline
try {
    $testRedis = docker exec insegnami-redis redis-cli ping 2>&1
    if ($testRedis -match "PONG") {
        Write-Host " ✅ OK" -ForegroundColor Green
    } else {
        Write-Host " ❌ Errore" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " ❌ Errore connessione" -ForegroundColor Red
    $allGood = $false
}

# Test porta 3000 libera
Write-Host "   Porta 3000..." -NoNewline
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host " ⚠️  In uso (normale se app già avviata)" -ForegroundColor Yellow
} else {
    Write-Host " ✅ Libera" -ForegroundColor Green
}

# Riepilogo finale
Write-Host ""
Write-Host "═══════════════════════════════════" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ Ambiente pronto!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Per avviare l'applicazione:" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   Oppure usa lo script automatico:" -ForegroundColor White
    Write-Host "   .\START.ps1" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Alcuni problemi rilevati" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Suggerimenti:" -ForegroundColor White
    Write-Host "   1. Installa Docker Desktop se mancante" -ForegroundColor Gray
    Write-Host "   2. Avvia Docker Desktop" -ForegroundColor Gray
    Write-Host "   3. Esegui: cd docker && docker-compose up -d && cd .." -ForegroundColor Gray
    Write-Host "   4. Esegui: npm install" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Documentazione completa: READY.md" -ForegroundColor Cyan
Write-Host ""
