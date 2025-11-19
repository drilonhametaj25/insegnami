# 🎉 InsegnaMi.pro - Ambiente Pronto!

## ✅ SETUP COMPLETATO

L'ambiente è stato configurato con successo e **completamente isolato** da altri progetti come PegasoWorld.

---

## 🚀 AVVIO RAPIDO

### Metodo 1: Script Automatico (CONSIGLIATO)
```powershell
.\START.ps1
```

Questo script fa tutto automaticamente:
- ✅ Verifica prerequisiti
- ✅ Avvia container Docker
- ✅ Controlla database
- ✅ Avvia l'applicazione

### Metodo 2: Manuale
```powershell
# 1. Avvia i servizi Docker (se non già attivi)
cd docker
docker-compose up -d
cd ..

# 2. Avvia l'applicazione
npm run dev
```

L'app sarà disponibile su: **http://localhost:3000**

---

## 🌐 SERVIZI ATTIVI (Porte Dedicate)

| Servizio | Porta | URL/Host |
|----------|-------|----------|
| **Next.js App** | 3000 | http://localhost:3000 |
| **PostgreSQL** | 5433 | localhost:5433 |
| **Redis** | 6380 | localhost:6380 |
| **MailHog Web** | 8026 | http://localhost:8026 |
| **MailHog SMTP** | 1026 | localhost:1026 |

### 💡 Nessun Conflitto!
Le porte sono diverse da PegasoWorld:
- PegasoWorld usa: 5432, 6379, 3000-3001
- InsegnaMi usa: 5433, 6380, 3000, 8026

Puoi avere **entrambi i progetti attivi contemporaneamente**!

---

## 🔑 CREDENZIALI DI ACCESSO

**Tutti gli account hanno password: `password`**

### 👨‍💼 Amministratore (Accesso Completo)
```
Email: admin@englishplus.it
Password: password
```
**Funzionalità**: Gestione completa di utenti, classi, corsi, pagamenti, report

### 👨‍🏫 Insegnante
```
Email: teacher@englishplus.it
Password: password
```
**Anche disponibile**: `teacher2@englishplus.it`  
**Funzionalità**: Gestione classi, lezioni, presenze, comunicazioni

### 🎓 Studente
```
Email: student@englishplus.it
Password: password
```
**Altri studenti disponibili**:
- giulia.romano@email.it
- luca.ferrari@email.it
- chiara.esposito@email.it
- andrea.conti@email.it
- sofia.ricci@email.it

**Funzionalità**: Visualizzazione calendario, presenze personali, comunicazioni

### 👨‍👩‍👧‍👦 Genitore
```
Email: parent@englishplus.it
Password: password
```
**Altri 5 account parent disponibili**  
**Funzionalità**: Visualizzazione presenze figlio, pagamenti, comunicazioni

---

## 📊 DATI DI ESEMPIO PRECARICATI

Il database include:

✅ **3 Corsi**:
- English for Beginners (A1-A2)
- Intermediate English (B1-B2)
- Advanced Business English (C1-C2)

✅ **3 Classi Attive**:
- Classe collegata a ciascun corso
- Studenti iscritti
- Insegnante assegnato

✅ **Lezioni Programmate**:
- Lezioni passate e future
- Presenze registrate per lezioni completate

✅ **Pagamenti**:
- Diversi stati: Paid, Pending, Overdue
- Distribuiti realisticamente

✅ **Comunicazioni**:
- Avvisi per tutti i ruoli
- Notifiche di esempio

---

## 🛠️ COMANDI UTILI

### Sviluppo
```powershell
npm run dev              # Avvia app in development
npm run build            # Build per produzione
npm run start            # Avvia in produzione
npm run lint             # Linting codice
npm run type-check       # Verifica TypeScript
```

### Database
```powershell
npm run db:studio        # Apri Prisma Studio (GUI)
npm run db:push          # Applica schema al DB
npm run db:seed          # Popola con dati esempio
npx prisma migrate reset --force  # Reset completo DB
```

### Test
```powershell
npm run test             # Tutti i test
npm run test:unit        # Solo unit test
npm run test:e2e         # Solo E2E test
npm run test:coverage    # Con coverage report
```

### Docker
```powershell
# Nella root del progetto
cd docker

docker-compose up -d      # Avvia tutti i container
docker-compose ps         # Stato container
docker-compose logs       # Vedi tutti i log
docker-compose logs -f postgres  # Segui log PostgreSQL
docker-compose restart    # Riavvia tutti
docker-compose stop       # Ferma (senza rimuovere)
docker-compose down       # Ferma e rimuovi
docker-compose down -v    # Ferma e rimuovi anche volumi

cd ..
```

### Accesso diretto ai servizi
```powershell
# PostgreSQL CLI
docker exec -it insegnami-postgres psql -U insegnami_user -d insegnami_db

# Redis CLI
docker exec -it insegnami-redis redis-cli

# Verifica log
docker logs insegnami-postgres
docker logs insegnami-redis
docker logs insegnami-mailhog
```

---

## 🔍 VERIFICA AMBIENTE

### 1. Verifica container Docker
```powershell
docker ps --filter "name=insegnami-"
```
Dovresti vedere 3 container:
- insegnami-postgres (healthy)
- insegnami-redis (healthy)
- insegnami-mailhog

### 2. Verifica connessione database
```powershell
npm run db:studio
```
Si apre il browser su http://localhost:5555 con la GUI del database

### 3. Verifica MailHog
Apri: http://localhost:8026  
Dovresti vedere l'interfaccia MailHog vuota (nessuna email ancora)

### 4. Test connessione Redis
```powershell
docker exec -it insegnami-redis redis-cli ping
# Dovrebbe rispondere: PONG
```

---

## 🐛 TROUBLESHOOTING

### ❌ Container non si avviano
```powershell
# Vedi i log per capire l'errore
cd docker
docker-compose logs

# Riavvia da zero
docker-compose down -v
docker-compose up -d
cd ..
```

### ❌ Porta già in uso
```powershell
# Trova il processo sulla porta (es. 5433)
netstat -ano | findstr :5433

# Termina il processo (sostituisci <PID>)
taskkill /PID <PID> /F
```

### ❌ Errore connessione database
1. Verifica che il container sia attivo e healthy
2. Attendi 10-15 secondi dopo l'avvio
3. Controlla il file `.env` che abbia la porta corretta (5433)

### ❌ Database vuoto
```powershell
# Ripopola il database
npm run db:seed
```

### ❌ Schema database non sincronizzato
```powershell
# Forza il reset e riapplica
npx prisma migrate reset --force
npm run db:seed
```

### ❌ Email non appaiono in MailHog
1. Verifica che MailHog sia attivo: `docker ps | findstr mailhog`
2. Controlla il `.env`: `SMTP_PORT=1026`
3. Apri la Web UI: http://localhost:8026

---

## 📚 DOCUMENTAZIONE COMPLETA

- **`QUICK_START_GUIDE.md`** - Guida completa con tutte le info
- **`MODULES_STATUS.md`** - Stato di tutti i moduli (cosa c'è, cosa manca)
- **`PROJECT_SUMMARY.md`** - Overview del progetto
- **`.github/copilot-instructions.md`** - Istruzioni architettura

---

## 🎯 PRIMI PASSI DOPO L'AVVIO

1. **Login come Admin**: http://localhost:3000
   - Email: `admin@englishplus.it`
   - Password: `password`

2. **Esplora la Dashboard**:
   - Vedi statistiche generali
   - KPI (studenti, presenze, revenue)

3. **Testa le funzionalità**:
   - `/dashboard/students` - Gestione studenti
   - `/dashboard/teachers` - Gestione insegnanti
   - `/dashboard/classes` - Gestione classi
   - `/dashboard/lessons` - Calendario lezioni
   - `/dashboard/attendance` - Registro presenze
   - `/dashboard/payments` - Gestione pagamenti
   - `/dashboard/notices` - Bacheca comunicazioni
   - `/dashboard/reports` - Report e analytics

4. **Cambia ruolo**:
   - Logout
   - Login come `teacher@englishplus.it`
   - Vedi la dashboard docente (diversa dall'admin)

5. **Testa le email**:
   - Crea un avviso nella bacheca
   - Le email verranno catturate in MailHog: http://localhost:8026

6. **Esplora il database**:
   - `npm run db:studio`
   - Esplora tabelle, relazioni, dati

---

## 🚀 SVILUPPO

### Workflow consigliato
1. Avvia i servizi Docker: `cd docker && docker-compose up -d && cd ..`
2. Avvia l'app: `npm run dev`
3. Apri Prisma Studio in un altro terminale: `npm run db:studio`
4. Fai modifiche al codice
5. L'app si ricarica automaticamente (hot reload)

### Testing durante sviluppo
```powershell
# Test in watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## ✅ CHECKLIST FUNZIONALITÀ

Puoi testare:

- [x] Login/Logout
- [x] Dashboard personalizzate per ruolo
- [x] CRUD Studenti
- [x] CRUD Insegnanti
- [x] CRUD Classi e Corsi
- [x] Calendario Lezioni (con drag&drop)
- [x] Registro Presenze
- [x] Gestione Pagamenti
- [x] Bacheca Comunicazioni
- [x] Sistema Messaggi
- [x] Report e Analytics
- [x] Cambio lingua (IT, EN, FR, PT)
- [x] Form con validazione
- [x] Filtri e ricerca
- [x] Paginazione

---

## 📊 STATO PROGETTO

- **Completezza**: ~85%
- **Moduli Core**: ✅ Completi
- **Automazione**: ⚠️ Parziale (queue da attivare)
- **File Upload**: ❌ Da implementare
- **PWA**: ⚠️ Preparato, non attivo

Vedi `MODULES_STATUS.md` per dettagli completi.

---

## 🎉 Buon lavoro!

Il sistema è pronto per:
- ✅ Testing completo
- ✅ Sviluppo feature mancanti
- ✅ Deployment (con modifiche al docker-compose per produzione)

**Prossimi step suggeriti**:
1. Testa tutti i flussi principali
2. Implementa file upload system (priorità)
3. Attiva email worker con BullMQ
4. Completa TODO nel codice

---

**Versione**: 1.0.0-rc1  
**Data Setup**: Ottobre 2025  
**Ambiente**: Development (isolato)
