# ============================================
# InsegnaMi.pro - Start Script Completo
# ============================================
# Questo script avvia tutto l'ambiente in un unico comando
# ============================================

Write-Host ""
Write-Host "╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🚀 InsegnaMi.pro - Start Script   ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Funzione per verificare se un comando esiste
function Test-Command {
    param($Command)
    try {
        if (Get-Command $Command -ErrorAction Stop) { return $true }
    } catch {
        return $false
    }
}

# Funzione per verificare se una porta è in uso
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
    return $connection
}

# ============================================
# 1. Verifica prerequisiti
# ============================================
Write-Host "📋 Step 1: Verifica prerequisiti..." -ForegroundColor Yellow

# Verifica Docker
if (-not (Test-Command "docker")) {
    Write-Host "❌ Docker non trovato!" -ForegroundColor Red
    Write-Host "   Installa Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Read-Host "Premi Enter per uscire"
    exit 1
}

# Verifica che Docker sia in esecuzione
try {
    docker info | Out-Null
    Write-Host "  ✅ Docker è in esecuzione" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker non è in esecuzione!" -ForegroundColor Red
    Write-Host "   Avvia Docker Desktop e riprova" -ForegroundColor Yellow
    Read-Host "Premi Enter per uscire"
    exit 1
}

# Verifica Node.js
if (-not (Test-Command "node")) {
    Write-Host "❌ Node.js non trovato!" -ForegroundColor Red
    Write-Host "   Installa Node.js 18+: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Premi Enter per uscire"
    exit 1
}

$nodeVersion = node --version
Write-Host "  ✅ Node.js trovato: $nodeVersion" -ForegroundColor Green

# Verifica npm
if (-not (Test-Command "npm")) {
    Write-Host "❌ npm non trovato!" -ForegroundColor Red
    Read-Host "Premi Enter per uscire"
    exit 1
}

# ============================================
# 2. Installa dipendenze npm
# ============================================
Write-Host "`n📦 Step 2: Verifica dipendenze..." -ForegroundColor Yellow

if (-not (Test-Path "node_modules")) {
    Write-Host "  📥 Installazione dipendenze (può richiedere qualche minuto)..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Errore durante l'installazione delle dipendenze" -ForegroundColor Red
        Read-Host "Premi Enter per uscire"
        exit 1
    }
    Write-Host "  ✅ Dipendenze installate" -ForegroundColor Green
} else {
    Write-Host "  ✅ Dipendenze già presenti" -ForegroundColor Green
}

# ============================================
# 3. Avvia servizi Docker
# ============================================
Write-Host "`n🐳 Step 3: Avvio servizi Docker..." -ForegroundColor Yellow

# Verifica porte libere
Write-Host "  🔍 Verifica disponibilità porte..." -ForegroundColor Cyan

$portsToCheck = @{
    5433 = "PostgreSQL"
    6380 = "Redis"
    1026 = "MailHog SMTP"
    8026 = "MailHog Web"
}

$portsInUse = @()
foreach ($port in $portsToCheck.Keys) {
    if (Test-Port -Port $port) {
        $portsInUse += "$port ($($portsToCheck[$port]))"
    }
}

if ($portsInUse.Count -gt 0) {
    Write-Host "  ⚠️  Attenzione: Alcune porte sono già in uso:" -ForegroundColor Yellow
    foreach ($portInfo in $portsInUse) {
        Write-Host "     - $portInfo" -ForegroundColor Yellow
    }
    Write-Host ""
    $response = Read-Host "  Vuoi procedere comunque? I container potrebbero non avviarsi. (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "❌ Operazione annullata" -ForegroundColor Red
        exit 0
    }
}

# Controlla se i container sono già in esecuzione
$existingContainers = docker ps --format "{{.Names}}" | Select-String -Pattern "insegnami-"

if ($existingContainers) {
    Write-Host "  ℹ️  Alcuni container InsegnaMi sono già in esecuzione" -ForegroundColor Cyan
    $response = Read-Host "  Vuoi riavviarli? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "  🔄 Riavvio container..." -ForegroundColor Cyan
        Set-Location docker
        docker-compose restart
        Set-Location ..
    }
} else {
    Write-Host "  🚀 Avvio container Docker..." -ForegroundColor Cyan
    Set-Location docker
    docker-compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Errore durante l'avvio dei container" -ForegroundColor Red
        Set-Location ..
        Read-Host "Premi Enter per uscire"
        exit 1
    }
    Set-Location ..
}

# Attendi che i servizi siano pronti
Write-Host "  ⏳ Attesa avvio servizi..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Verifica che i container siano in esecuzione
$runningContainers = docker ps --format "{{.Names}}" | Select-String -Pattern "insegnami-"
if ($runningContainers) {
    Write-Host "  ✅ Container attivi:" -ForegroundColor Green
    docker ps --filter "name=insegnami-" --format "     - {{.Names}} ({{.Status}})"
} else {
    Write-Host "  ⚠️  Nessun container InsegnaMi in esecuzione" -ForegroundColor Yellow
    Write-Host "     Verifica i log con: docker-compose logs" -ForegroundColor Gray
}

# ============================================
# 4. Setup database
# ============================================
Write-Host "`n🗄️  Step 4: Setup database..." -ForegroundColor Yellow

# Verifica se il database è già stato configurato
$dbExists = $false
try {
    # Prova a connettersi al database
    npx prisma db pull --schema=./prisma/schema.prisma 2>&1 | Out-Null
    $dbExists = $true
} catch {
    $dbExists = $false
}

if (-not $dbExists) {
    Write-Host "  📝 Applicazione schema database..." -ForegroundColor Cyan
    npm run db:push
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Errore durante l'applicazione dello schema" -ForegroundColor Red
        Write-Host "   Verifica che PostgreSQL sia attivo: docker ps" -ForegroundColor Yellow
        Read-Host "Premi Enter per uscire"
        exit 1
    }
    Write-Host "  ✅ Schema database applicato" -ForegroundColor Green

    Write-Host "  🌱 Popolamento database con dati di esempio..." -ForegroundColor Cyan
    npm run db:seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Errore durante il seeding del database" -ForegroundColor Red
        Read-Host "Premi Enter per uscire"
        exit 1
    }
    Write-Host "  ✅ Database popolato con successo" -ForegroundColor Green
} else {
    Write-Host "  ✅ Database già configurato" -ForegroundColor Green
    $response = Read-Host "  Vuoi ripopolare il database? (Cancellerà i dati esistenti) (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "  🔄 Reset e seeding database..." -ForegroundColor Cyan
        npm run db:push -- --force-reset
        npm run db:seed
        Write-Host "  ✅ Database ripopolato" -ForegroundColor Green
    }
}

# ============================================
# 5. Riepilogo
# ============================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           🎉 Setup completato con successo! 🎉           ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "🌐 Servizi attivi (ambiente dedicato):" -ForegroundColor White
Write-Host ""
Write-Host "  📊 PostgreSQL:        localhost:5433" -ForegroundColor Cyan
Write-Host "  🔴 Redis:             localhost:6380" -ForegroundColor Cyan
Write-Host "  📧 MailHog Web UI:    http://localhost:8026" -ForegroundColor Cyan
Write-Host "  📮 MailHog SMTP:      localhost:1026" -ForegroundColor Cyan
Write-Host ""
Write-Host "  💡 Nessun conflitto con altri progetti!" -ForegroundColor Gray
Write-Host ""

Write-Host "👥 Account di test (password: 'password'):" -ForegroundColor White
Write-Host ""
Write-Host "  👨‍💼 Admin:    admin@englishplus.it" -ForegroundColor Yellow
Write-Host "  👨‍🏫 Teacher:  teacher@englishplus.it" -ForegroundColor Yellow
Write-Host "  🎓 Student:  student@englishplus.it" -ForegroundColor Yellow
Write-Host "  👨‍👩‍👧‍👦 Parent:   parent@englishplus.it" -ForegroundColor Yellow
Write-Host ""

Write-Host "📚 Dati di esempio:" -ForegroundColor White
Write-Host "  • 3 corsi (Beginner, Intermediate, Advanced)" -ForegroundColor Gray
Write-Host "  • 3 classi attive con studenti" -ForegroundColor Gray
Write-Host "  • Lezioni programmate" -ForegroundColor Gray
Write-Host "  • Presenze e pagamenti di esempio" -ForegroundColor Gray
Write-Host ""

Write-Host "🛠️  Comandi utili:" -ForegroundColor White
Write-Host ""
Write-Host "  npm run dev           → Avvia l'applicazione" -ForegroundColor Cyan
Write-Host "  npm run db:studio     → Apri Prisma Studio (DB GUI)" -ForegroundColor Cyan
Write-Host "  npm run test          → Esegui test" -ForegroundColor Cyan
Write-Host ""
Write-Host "  cd docker && docker-compose logs    → Vedi log servizi" -ForegroundColor Gray
Write-Host "  cd docker && docker-compose down    → Ferma servizi" -ForegroundColor Gray
Write-Host ""

# ============================================
# 6. Avvio applicazione
# ============================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
$response = Read-Host "🚀 Vuoi avviare l'applicazione ora? (Y/n)"

if ($response -ne "n" -and $response -ne "N") {
    Write-Host ""
    Write-Host "🚀 Avvio InsegnaMi.pro..." -ForegroundColor Green
    Write-Host ""
    Write-Host "   L'applicazione sarà disponibile su:" -ForegroundColor White
    Write-Host "   👉 http://localhost:3000" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Premi Ctrl+C per fermare il server" -ForegroundColor Gray
    Write-Host ""
    Start-Sleep -Seconds 2
    
    npm run dev
} else {
    Write-Host ""
    Write-Host "✅ Setup completato!" -ForegroundColor Green
    Write-Host "   Per avviare l'applicazione in seguito, esegui:" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor Cyan
    Write-Host ""
}
