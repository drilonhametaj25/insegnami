# PROMPT PER CLAUDE CODE — InsegnaMi.pro
## Completamento e Lancio del Registro Elettronico

---

## CONTESTO PER CLAUDE CODE

Stai lavorando su **InsegnaMi.pro**, un registro elettronico e gestionale scolastico SaaS.

**Stack tecnologico:**
- Next.js 15 (App Router) + TypeScript
- Prisma ORM + PostgreSQL
- NextAuth.js (Auth.js v5 beta)
- Mantine UI v7 + Tailwind CSS
- TanStack Query (React Query)
- BullMQ + Redis (job queue)
- next-intl (i18n: IT, EN, FR, PT)
- Chart.js + Recharts (analytics)
- react-big-calendar (calendario)
- Jest + Playwright (testing)
- Docker (PostgreSQL, Redis, MailHog)

**Architettura attuale:**
- Multi-tenant (row-level con tenantId)
- 4 ruoli: ADMIN, TEACHER, STUDENT, PARENT
- ~55.000 righe di codice, 207 file TS/TSX
- 69 endpoint API
- Schema Prisma con 25+ modelli

---

## LEGGI QUESTA GUIDA PRIMA DI FARE QUALSIASI COSA

Segui la metodologia in `GUIDA_SVILUPPO_GESTIONALI_V2.md` allegata alla repo:
1. Leggi TUTTA la guida
2. Auto-genera i documenti architetturali in `/docs`
3. Crea `TASKS.md` con task sequenziali
4. Esegui UN task alla volta, verifica, poi procedi
5. MAI procedere se il task corrente non funziona

---

## FASE 0: AUDIT — STATO ATTUALE DEL PROGETTO

### ✅ MODULI FUNZIONANTI (~85% completezza)

| Modulo | % | Note |
|--------|---|------|
| Auth & RBAC | 100% | Login, register, forgot/reset pwd, JWT, middleware |
| User Management | 100% | CRUD, ruoli, permessi, multi-tenant |
| Students | 95% | CRUD, dettaglio 4 tabs, enrollment, manca upload avatar/docs |
| Teachers | 95% | CRUD, qualifiche, specializzazioni, manca calcolo esperienza |
| Courses & Classes | 100% | Livelli, capacità, enrollment, assignment docenti |
| Lessons & Calendar | 90% | react-big-calendar, ricorrenti, drag&drop, manca gestione conflitti |
| Attendance | 90% | Griglia, bulk update, 4 stati, export, manca edit modal |
| Payments | 85% | Fee, stati, stats, grafici, mancano ricevute e reminder |
| Communications | 80% | Notice, messaggi, notifiche, template, manca email worker |
| Reports & Analytics | 90% | Dashboard KPI, grafici, export PDF, manca Excel |
| Automation | 75% | BullMQ setup, manca worker attivo |
| i18n | 100% | 4 lingue complete |
| Testing | 90% | Jest, RTL, Playwright, MSW, 30+ test files |

### ⚠️ MODULI PARZIALI

| Modulo | % | Note |
|--------|---|------|
| Materials Management | 40% | UI presente, manca backend upload/storage |
| PWA | 30% | Responsive ok, manca manifest/SW/offline |
| File Upload System | 10% | Blocca avatar, materiali, documenti |

### ❌ FEATURE CRITICHE COMPLETAMENTE MANCANTI

**Queste sono le feature che rendono un registro elettronico INUTILIZZABILE senza di esse:**

| Feature | Impatto | Priorità |
|---------|---------|----------|
| **VOTI / VALUTAZIONI** | Nessun modello Grade/Evaluation nello schema! | 🔴 CRITICA |
| **PAGELLE / REPORT CARD** | Nessun sistema di generazione pagelle | 🔴 CRITICA |
| **MATERIE / SUBJECTS** | Non esiste un modello Subject separato | 🔴 CRITICA |
| **ANNO SCOLASTICO** | Nessun modello AcademicYear/SchoolYear | 🔴 CRITICA |
| **NOTE DISCIPLINARI** | Nessun sistema note comportamento | 🟡 IMPORTANTE |
| **REGISTRO DI CLASSE** | Non c'è il classico "registro di classe" per giornata | 🟡 IMPORTANTE |
| **COMPITI A CASA** | Solo campo testo in Lesson, nessuna gestione strutturata | 🟡 IMPORTANTE |
| **COLLOQUI GENITORI** | Nessun sistema prenotazione colloqui | 🟡 IMPORTANTE |
| **ORARIO SCOLASTICO** | Nessun generatore/gestione orario settimanale | 🟡 IMPORTANTE |
| **SCRUTINI** | Nessun workflow per scrutini | 🟡 IMPORTANTE |
| **AUDIT LOG** | Nessun tracking modifiche | 🟠 UTILE |
| **SEARCH GLOBALE** | Nessuna ricerca full-text | 🟠 UTILE |
| **LANDING PAGE PROFESSIONALE** | Attuale è basica, no SEO, no blog | 🟠 MARKETING |

### ❌ MODULI NON INIZIATI (SaaS/Future)

| Modulo | Note |
|--------|------|
| Billing & Subscriptions (Stripe) | Solo per SaaS mode |
| Super Admin Panel | Gestione tenant |
| Third-party Integrations | Google Calendar, Zoom, Stripe |

---

## FASE 1: NUOVI MODELLI PRISMA DA AGGIUNGERE

### Aggiungi questi modelli allo schema.prisma:

```prisma
// ========================================
// ANNO SCOLASTICO
// ========================================
model AcademicYear {
  id        String   @id @default(cuid())
  tenantId  String
  
  name      String   // "2025/2026"
  startDate DateTime
  endDate   DateTime
  isCurrent Boolean  @default(false)
  
  // Trimestri/Quadrimestri
  periods   AcademicPeriod[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, name])
  @@map("academic_years")
}

model AcademicPeriod {
  id              String   @id @default(cuid())
  academicYearId  String
  
  name            String   // "1° Quadrimestre", "2° Quadrimestre"
  type            PeriodType @default(QUADRIMESTRE)
  startDate       DateTime
  endDate         DateTime
  orderIndex      Int      @default(0)
  
  grades          Grade[]
  reportCards     ReportCard[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  academicYear    AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  
  @@map("academic_periods")
}

enum PeriodType {
  TRIMESTRE
  QUADRIMESTRE
  SEMESTRE
  PENTAMESTRE
}

// ========================================
// MATERIE
// ========================================
model Subject {
  id        String   @id @default(cuid())
  tenantId  String
  
  name      String   // "Matematica", "Italiano"
  code      String   // "MAT", "ITA"
  color     String?  @default("#3b82f6")
  icon      String?
  
  // Ore settimanali previste (utile per orario)
  weeklyHours Int?
  
  isActive  Boolean  @default(true)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  teachers  TeacherSubject[]
  grades    Grade[]
  homework  Homework[]
  classSubjects ClassSubject[]
  
  @@unique([tenantId, code])
  @@map("subjects")
}

model TeacherSubject {
  id        String @id @default(cuid())
  teacherId String
  subjectId String
  
  teacher   Teacher @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  
  @@unique([teacherId, subjectId])
  @@map("teacher_subjects")
}

model ClassSubject {
  id        String @id @default(cuid())
  classId   String
  subjectId String
  teacherId String // Il docente che insegna questa materia in questa classe
  
  weeklyHours Int @default(1)
  
  class     Class   @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher   Teacher @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  
  @@unique([classId, subjectId])
  @@map("class_subjects")
}

// ========================================
// VOTI / VALUTAZIONI
// ========================================
model Grade {
  id          String    @id @default(cuid())
  tenantId    String
  studentId   String
  subjectId   String
  teacherId   String
  classId     String
  periodId    String?   // Collegato al periodo accademico
  
  // Voto
  value       Decimal   @db.Decimal(4,2) // 6.50, 7.00, ecc.
  valueText   String?   // "Sufficiente", "Buono" (per scuola primaria)
  weight      Decimal   @default(1.0) @db.Decimal(3,1) // Peso del voto
  
  // Tipo
  type        GradeType @default(WRITTEN)
  
  // Dettagli
  description String?   // "Verifica equazioni 2° grado"
  date        DateTime
  
  // Visibilità
  isVisible   Boolean   @default(true) // Visibile a studente/genitore
  
  notes       String?
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  student     Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject     Subject   @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher     Teacher   @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  class       Class     @relation(fields: [classId], references: [id], onDelete: Cascade)
  period      AcademicPeriod? @relation(fields: [periodId], references: [id])
  
  @@index([studentId, subjectId])
  @@index([classId, subjectId])
  @@map("grades")
}

enum GradeType {
  ORAL       // Interrogazione
  WRITTEN    // Compito in classe / Verifica
  PRACTICAL  // Laboratorio / Pratica
  HOMEWORK   // Compiti a casa
  PROJECT    // Progetto
  TEST       // Test rapido
  BEHAVIOR   // Voto di condotta (se numerico)
}

// ========================================
// PAGELLE / REPORT CARD
// ========================================
model ReportCard {
  id          String   @id @default(cuid())
  tenantId    String
  studentId   String
  classId     String
  periodId    String
  
  // Stato
  status      ReportCardStatus @default(DRAFT)
  
  // Voti finali per materia
  entries     ReportCardEntry[]
  
  // Giudizio globale
  overallComment String?
  behaviorGrade  String? // Voto condotta
  
  // Firme
  approvedBy     String? // ID del dirigente/coordinatore
  approvedAt     DateTime?
  
  // PDF generato
  pdfUrl         String?
  generatedAt    DateTime?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant      Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  student     Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  class       Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  period      AcademicPeriod @relation(fields: [periodId], references: [id])
  
  @@unique([studentId, classId, periodId])
  @@map("report_cards")
}

model ReportCardEntry {
  id            String @id @default(cuid())
  reportCardId  String
  subjectId     String
  
  // Voto finale
  finalGrade    Decimal @db.Decimal(4,2)
  finalGradeText String? // Per primaria
  
  // Medie calcolate (snapshot)
  averageOral     Decimal? @db.Decimal(4,2)
  averageWritten  Decimal? @db.Decimal(4,2)
  averagePractical Decimal? @db.Decimal(4,2)
  overallAverage  Decimal? @db.Decimal(4,2)
  
  // Giudizio docente
  teacherComment  String?
  
  // Assenze per materia
  absenceCount    Int @default(0)
  
  reportCard      ReportCard @relation(fields: [reportCardId], references: [id], onDelete: Cascade)
  
  @@unique([reportCardId, subjectId])
  @@map("report_card_entries")
}

enum ReportCardStatus {
  DRAFT
  IN_REVIEW    // Allo scrutinio
  APPROVED     // Approvata dal consiglio
  PUBLISHED    // Visibile a studente/genitore
  ARCHIVED
}

// ========================================
// NOTE DISCIPLINARI
// ========================================
model DisciplinaryNote {
  id          String   @id @default(cuid())
  tenantId    String
  studentId   String
  teacherId   String
  classId     String
  
  type        DisciplinaryType @default(NOTE)
  severity    Severity         @default(MEDIUM)
  
  title       String
  description String
  date        DateTime
  
  // Notifica genitore
  parentNotified    Boolean  @default(false)
  parentNotifiedAt  DateTime?
  
  // Risoluzione
  resolved      Boolean  @default(false)
  resolvedAt    DateTime?
  resolvedBy    String?
  resolution    String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  teacher   Teacher @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  class     Class   @relation(fields: [classId], references: [id], onDelete: Cascade)
  
  @@map("disciplinary_notes")
}

enum DisciplinaryType {
  NOTE           // Nota sul registro
  WARNING        // Ammonizione
  SUSPENSION     // Sospensione
  POSITIVE       // Nota positiva/merito
}

enum Severity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// ========================================
// COMPITI A CASA
// ========================================
model Homework {
  id          String   @id @default(cuid())
  tenantId    String
  classId     String
  subjectId   String
  teacherId   String
  lessonId    String?  // Opzionale: collegato a lezione
  
  title       String
  description String
  
  assignedDate DateTime
  dueDate      DateTime
  
  // Attachments (URL o riferimenti file)
  attachments  Json?   @default("[]")
  
  // Stato
  isPublished Boolean @default(true)
  
  // Submissions degli studenti
  submissions HomeworkSubmission[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  class     Class   @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  teacher   Teacher @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  lesson    Lesson? @relation(fields: [lessonId], references: [id])
  
  @@map("homework")
}

model HomeworkSubmission {
  id          String   @id @default(cuid())
  homeworkId  String
  studentId   String
  
  content     String?
  attachments Json?    @default("[]")
  
  submittedAt DateTime @default(now())
  
  // Valutazione docente
  grade       Decimal? @db.Decimal(4,2)
  feedback    String?
  gradedAt    DateTime?
  
  homework    Homework @relation(fields: [homeworkId], references: [id], onDelete: Cascade)
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  @@unique([homeworkId, studentId])
  @@map("homework_submissions")
}

// ========================================
// COLLOQUI GENITORI
// ========================================
model ParentMeeting {
  id          String   @id @default(cuid())
  tenantId    String
  teacherId   String
  parentId    String   // User ID del genitore
  studentId   String
  
  // Scheduling
  date        DateTime
  duration    Int      @default(15) // minuti
  room        String?
  
  // Stato
  status      MeetingStatus @default(REQUESTED)
  
  // Note
  teacherNotes String?
  parentNotes  String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  teacher   Teacher @relation(fields: [teacherId], references: [id], onDelete: Restrict)
  student   Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  @@map("parent_meetings")
}

enum MeetingStatus {
  REQUESTED
  CONFIRMED
  CANCELLED
  COMPLETED
}

// ========================================
// AUDIT LOG
// ========================================
model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  
  action    String   // "CREATE", "UPDATE", "DELETE", "STATE_CHANGE"
  entity    String   // "Student", "Grade", "Attendance"
  entityId  String
  
  // Dati prima/dopo (JSON)
  oldData   Json?
  newData   Json?
  
  // Metadata
  ipAddress String?
  userAgent String?
  
  createdAt DateTime @default(now())
  
  @@index([tenantId, entity, entityId])
  @@index([tenantId, userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### Relazioni da aggiungere ai modelli ESISTENTI:

```prisma
// Aggiungi a Tenant:
  subjects         Subject[]
  academicYears    AcademicYear[]
  grades           Grade[]
  reportCards      ReportCard[]
  disciplinaryNotes DisciplinaryNote[]
  homework         Homework[]
  parentMeetings   ParentMeeting[]

// Aggiungi a Student:
  grades           Grade[]
  reportCards      ReportCard[]
  disciplinaryNotes DisciplinaryNote[]
  homeworkSubmissions HomeworkSubmission[]
  parentMeetings   ParentMeeting[]

// Aggiungi a Teacher:
  subjects         TeacherSubject[]
  classSubjects    ClassSubject[]
  grades           Grade[]
  disciplinaryNotes DisciplinaryNote[]
  homework         Homework[]
  parentMeetings   ParentMeeting[]

// Aggiungi a Class:
  classSubjects    ClassSubject[]
  grades           Grade[]
  reportCards      ReportCard[]
  disciplinaryNotes DisciplinaryNote[]
  homework         Homework[]

// Aggiungi a Lesson:
  homework         Homework[]
```

---

## FASE 2: TASK SEQUENZIALI DI IMPLEMENTAZIONE

### ORDINE DI ESECUZIONE — NON SALTARE NESSUN TASK

---

### BLOCCO A: COMPLETARE IL CORE MANCANTE (Priorità 🔴)

#### TASK A1: Schema DB — Nuovi modelli
**Prerequisiti**: Nessuno
**Azioni**:
1. Aggiungi tutti i nuovi modelli Prisma dalla Fase 1
2. Aggiungi le relazioni ai modelli esistenti
3. Crea migration: `npx prisma migrate dev --name add_school_core_models`
4. Aggiorna il seed con dati demo per i nuovi modelli

**Verifica**: `npx prisma generate` OK, `npx prisma db push` OK

---

#### TASK A2: Modulo Subjects (Materie)
**Prerequisiti**: A1
**Azioni**:
1. API CRUD: `app/api/subjects/route.ts` e `[id]/route.ts`
2. API stats: `app/api/subjects/stats/route.ts`
3. Hook: `lib/hooks/useSubjects.ts`
4. Form: `components/forms/SubjectForm.tsx`
5. Pagina lista: `app/[locale]/dashboard/subjects/page.tsx`
6. Pagina dettaglio: `app/[locale]/dashboard/subjects/[id]/page.tsx`
7. Aggiungi voce nella Sidebar per ADMIN
8. Aggiungi traduzioni in tutti i file messages/*.json

**Verifica**: CRUD completo funzionante, navigazione OK

---

#### TASK A3: Modulo Academic Year (Anno Scolastico)
**Prerequisiti**: A1
**Azioni**:
1. API CRUD per AcademicYear e AcademicPeriod
2. Pagina impostazioni anno scolastico nel pannello admin
3. Logica per "anno corrente" (isCurrent)
4. Filtro globale per anno scolastico nella sidebar/navbar
5. Seed: crea anno 2025/2026 con 2 quadrimestri

**Verifica**: Creazione anno + periodi funzionante, switch anno visibile

---

#### TASK A4: Modulo Grades (Voti) — IL PIÙ IMPORTANTE
**Prerequisiti**: A1, A2, A3
**Azioni**:
1. API CRUD: `app/api/grades/route.ts` e `[id]/route.ts`
2. API stats per studente: `app/api/grades/student/[id]/route.ts`
3. API stats per classe/materia: `app/api/grades/class/[id]/route.ts`
4. API media voti: `app/api/grades/averages/route.ts`
5. Hook: `lib/hooks/useGrades.ts`
6. **Componente inserimento voti** (la UX più critica):
   - Vista "registro del docente" = griglia classe × materia
   - Click su cella → modal inserimento voto (valore, tipo, descrizione, peso)
   - Color-coding: rosso < 6, giallo 6, verde > 6
   - Media automatica (pesata per tipo)
7. **Pagina voti per docente**: `app/[locale]/dashboard/grades/page.tsx`
   - Seleziona classe → materia → vedi griglia voti
   - Inserimento rapido voti
8. **Pagina voti per studente**: nel tab del dettaglio studente
   - Tutti i voti per materia
   - Media per materia
   - Grafico andamento
9. **Pagina voti per genitore**: dashboard parent aggiornata
   - Voti recenti del figlio
   - Medie per materia
   - Notifica nuovo voto
10. Aggiungi a Sidebar: voce "Voti" per ADMIN e TEACHER
11. Traduzioni i18n

**Verifica**: Inserimento, visualizzazione, medie, notifica — tutto funzionante

---

#### TASK A5: Modulo Note Disciplinari
**Prerequisiti**: A1
**Azioni**:
1. API CRUD
2. Hook: `lib/hooks/useDisciplinaryNotes.ts`
3. Pagina gestione note: `app/[locale]/dashboard/disciplinary/page.tsx`
4. Inserimento nota dal registro di classe
5. Notifica automatica al genitore
6. Tab "Note" nel dettaglio studente
7. Sidebar + traduzioni

**Verifica**: CRUD + notifica genitore funzionanti

---

#### TASK A6: Modulo Homework (Compiti)
**Prerequisiti**: A1, A2
**Azioni**:
1. API CRUD homework
2. API submissions per studenti
3. Pagina docente: assegna compiti per classe/materia
4. Pagina studente: lista compiti + consegna
5. Pagina genitore: compiti assegnati al figlio
6. Widget "compiti in scadenza" nella dashboard studente
7. Sidebar + traduzioni

**Verifica**: Assegnazione, visualizzazione, consegna funzionanti

---

#### TASK A7: Modulo Report Card (Pagelle)
**Prerequisiti**: A1, A3, A4
**Azioni**:
1. API CRUD report card
2. Workflow scrutinio:
   - Stato DRAFT: il sistema pre-calcola le medie
   - Il docente può modificare il voto finale
   - Stato IN_REVIEW: visibile al consiglio di classe
   - Stato APPROVED: approvata dal dirigente
   - Stato PUBLISHED: visibile a studente e genitore
3. **Generazione PDF pagella** (jsPDF già in dipendenze):
   - Layout conforme ministeriale (intestazione scuola, dati studente, tabella voti, giudizio)
   - Download da parte di genitore e studente
4. Pagina scrutini per admin: `app/[locale]/dashboard/report-cards/page.tsx`
5. Pagina visione pagella per studente/genitore
6. Sidebar + traduzioni

**Verifica**: Generazione pagella end-to-end: medie → scrutinio → PDF

---

#### TASK A8: Modulo Parent Meetings (Colloqui)
**Prerequisiti**: A1
**Azioni**:
1. API CRUD
2. Pagina docente: imposta disponibilità
3. Pagina genitore: prenota colloquio
4. Notifica email conferma/cancellazione
5. Calendario colloqui
6. Sidebar + traduzioni

**Verifica**: Prenotazione + notifica funzionanti

---

### BLOCCO B: COMPLETARE MODULI ESISTENTI (Priorità 🟡)

#### TASK B1: File Upload System
**Prerequisiti**: Nessuno
**Azioni**:
1. API upload: `app/api/upload/route.ts`
2. Storage locale in `public/uploads/` con path organizzato per tenant
3. Validazione tipo/dimensione file
4. Avatar per users, students, teachers
5. Upload documenti studente
6. Upload materiali didattici

**Verifica**: Upload e visualizzazione avatar funzionanti

---

#### TASK B2: Email Worker Attivo
**Prerequisiti**: Nessuno
**Azioni**:
1. Attiva il worker BullMQ in `lib/automation-worker.ts`
2. Processing email queue reale
3. Retry logic (3 tentativi)
4. Logging job status
5. Reminder automatici per: pagamenti scaduti, assenze, nuovi voti

**Verifica**: Email arrivano a MailHog dopo trigger

---

#### TASK B3: Completare Payments
**Azioni**:
1. Dropdown metodi pagamento reali (Cash, Bonifico, POS, PayPal)
2. Generazione ricevuta PDF
3. Reminder automatico email per scadenze
4. Gestione rate (installments)
5. Payment history nel dettaglio studente

---

#### TASK B4: Completare Attendance
**Azioni**:
1. Modal edit presenze passate con motivazione
2. Alert per assenze ripetute (>3 consecutive)
3. Notifica automatica al genitore per assenza
4. Trend analysis presenze per studente

---

#### TASK B5: Completare Calendar
**Azioni**:
1. Gestione conflitti aula/docente
2. Export iCal/Google Calendar
3. Vista timeline per docente (tutti i suoi impegni)

---

#### TASK B6: Audit Log
**Prerequisiti**: A1
**Azioni**:
1. Middleware/utility per logging automatico azioni CRUD
2. Pagina admin: `app/[locale]/dashboard/admin/audit-log/page.tsx`
3. Filtri per utente, entità, data, azione
4. Dettaglio diff prima/dopo

---

### BLOCCO C: LANDING, BLOG, SEO & MARKETING (Priorità 🟠)

#### TASK C1: Landing Page Professionale
**Azioni**:
1. **Riscrivi completamente `app/page.tsx`** con design premium:
   - Hero section con headline potente + CTA + screenshot/mockup animato
   - Social proof (numeri reali quando disponibili, altrimenti credibili)
   - Feature showcase con icone e micro-animazioni
   - Sezione "Come funziona" in 3 step
   - Pricing table (Free self-hosted vs SaaS plans)
   - Testimonials (placeholder realistici per scuole italiane)
   - FAQ section con schema markup
   - Footer con link utili, contatti, social
2. **Animazioni GSAP o Framer Motion** per effetto WOW
3. **Responsive perfetto** (mobile first)
4. **Dark/light mode** toggle
5. **Video demo** placeholder (embed YouTube)

---

#### TASK C2: Blog System
**Azioni**:
1. Modello Prisma `BlogPost` (title, slug, content MDX, author, category, tags, publishedAt, seoTitle, seoDescription, ogImage)
2. Pagina lista blog: `app/[locale]/blog/page.tsx`
3. Pagina singolo articolo: `app/[locale]/blog/[slug]/page.tsx`
4. Panel admin per scrivere articoli
5. Rendering MDX con syntax highlighting
6. Categorie: "Guide", "Normativa", "Tutorial", "News"
7. **Articoli iniziali da creare** (almeno titoli e struttura):
   - "Registro elettronico: obblighi normativi per le scuole italiane 2025"
   - "Come passare da Argo a InsegnaMi in 5 step"
   - "PNRR e digitalizzazione scolastica: opportunità per le scuole"
   - "Guida completa al registro elettronico per docenti"
   - "Privacy e GDPR nella scuola: cosa sapere"

---

#### TASK C3: Mini Tool Gratuiti (Lead Magnet)
**Azioni**:
1. **Calcolatore Media Voti**: `app/[locale]/tools/grade-calculator/page.tsx`
   - Input voti con pesi → calcolo media ponderata
   - "Usa InsegnaMi per automatizzare tutto questo" CTA
2. **Generatore Orario Scolastico**: `app/[locale]/tools/timetable-generator/page.tsx`
   - Input materie, docenti, vincoli → genera orario
   - CTA: "Con InsegnaMi l'orario è integrato col registro"
3. **Template PDP/PEI scaricabile**: `app/[locale]/tools/templates/page.tsx`
   - Template Word/PDF per PDP e PEI
   - CTA: "InsegnaMi gestisce PDP e PEI digitalmente"
4. Pagina tools hub: `app/[locale]/tools/page.tsx`
5. Ogni tool ha propria meta SEO

---

#### TASK C4: SEO Optimization
**Azioni**:
1. **Meta tags dinamici** per ogni pagina pubblica (title, description, og:image)
2. **Schema markup** (JSON-LD):
   - SoftwareApplication per la home
   - BlogPosting per articoli
   - FAQPage per FAQ
   - Organization per Anthropic/InsegnaMi
3. **Sitemap.xml** dinamico: `app/sitemap.ts`
4. **Robots.txt**: `app/robots.ts`
5. **Canonical URLs**
6. **Breadcrumbs** con markup strutturato
7. **Performance**: lazy loading immagini, font optimization
8. **Keywords target**:
   - "registro elettronico"
   - "registro elettronico scuola"
   - "alternativa argo"
   - "registro elettronico gratis"
   - "registro elettronico open source"
   - "gestionale scolastico"
   - "registro presenze scuola"

---

#### TASK C5: Demo Mode
**Azioni**:
1. Endpoint: `app/[locale]/demo/page.tsx`
2. Crea tenant demo con dati realistici pre-popolati
3. Login automatico senza registrazione
4. Banner "Stai usando la DEMO" con CTA "Installa per la tua scuola"
5. Reset automatico dati demo ogni 24h (cron job)
6. 4 account demo: admin, docente, studente, genitore

---

### BLOCCO D: FEATURE EFFETTO WOW (Priorità 🌟)

#### TASK D1: Dashboard Studente Gamificata
**Azioni**:
1. Sistema "punti" basato su: presenze, voti, compiti consegnati
2. Badge/achievements: "5 giorni senza assenze", "Media sopra l'8", ecc.
3. Leaderboard di classe (opzionale, attivabile da admin)
4. Streak presenze con animazione
5. Grafico radar competenze per materia

---

#### TASK D2: AI Assistant per Docenti
**Azioni**:
1. Bottone "Genera commento" nella pagella → genera giudizio automatico basato sui voti
2. "Suggerisci intervento" per studenti con medie basse
3. Analisi pattern: "Lo studente X ha un calo in Matematica nelle ultime 4 settimane"
4. Usa API Anthropic (Claude) se disponibile, altrimenti template intelligenti

---

#### TASK D3: QR Code Check-in Presenze
**Azioni**:
1. Genera QR code per ogni lezione
2. Studente scansiona → presenza registrata
3. QR valido solo per 15 minuti dall'inizio lezione
4. Fallback: docente marca manualmente
5. Geolocalizzazione opzionale (verifica che lo studente sia a scuola)

---

#### TASK D4: Notifiche Real-time
**Azioni**:
1. Server-Sent Events (SSE) o WebSocket per notifiche live
2. Suono notifica per nuovi voti (genitore)
3. Badge contatore non-lette nella sidebar
4. Toast notification in-app

---

#### TASK D5: App Mobile (PWA)
**Azioni**:
1. `manifest.json` completo
2. Service Worker con caching strategy
3. Offline mode: vedi ultimi dati cached
4. Install prompt
5. Push notification via Web Push API
6. Icone app per iOS e Android

---

### BLOCCO E: PREPARAZIONE PRODUZIONE

#### TASK E1: Security Hardening
**Azioni**:
1. Rate limiting su tutte le API
2. Input sanitization (XSS prevention)
3. CSRF protection
4. Password policy (min 8 char, uppercase, number)
5. Session timeout configurabile
6. Brute force protection (lockout dopo 5 tentativi)

---

#### TASK E2: Performance
**Azioni**:
1. API response caching con Redis
2. Database query optimization (indici, select specifici)
3. Image optimization (next/image + sharp)
4. Bundle analysis e code splitting
5. Lazy loading componenti pesanti (calendar, charts)

---

#### TASK E3: Testing Completo
**Azioni**:
1. Test unitari per TUTTI i nuovi moduli (grades, report cards, ecc.)
2. Test integrazione API
3. Test E2E flussi critici:
   - Inserimento voto → notifica genitore
   - Scrutinio → generazione pagella → download PDF
   - Registrazione presenze → notifica assenza
4. Test performance (lighthouse score > 90)

---

#### TASK E4: Deploy Configuration
**Azioni**:
1. Dockerfile production ottimizzato
2. Docker Compose con tutte le variabili env
3. Caddy/Nginx reverse proxy configurato
4. SSL/HTTPS
5. Backup automatico DB (cron + pg_dump)
6. Health check endpoint: `app/api/health/route.ts`
7. Documentazione deployment step-by-step

---

## REGOLE FERREE PER CLAUDE CODE

### MAI:
- Creare tipi duplicati → usa sempre `@/types/shared/` o il Prisma client
- Modificare più di 3 file senza conferma
- Procedere se `npm run type-check` fallisce
- Ignorare i side-effects (es: nuovo voto → notifica genitore)
- Dimenticare le traduzioni i18n
- Dimenticare il tenantId nelle query
- Fare query senza filtro tenant (MULTI-TENANT È OBBLIGATORIO)

### SEMPRE:
- Leggere i file esistenti prima di scrivere codice
- Usare TanStack Query per lo state management API
- Usare Mantine per i componenti UI
- Validare input con Zod
- Gestire errori con try/catch e messaggi user-friendly
- Aggiungere traduzioni in TUTTI e 4 i file messages/
- Scrivere test per le nuove feature
- Aggiornare la Sidebar con nuove voci di menu
- Rispettare il pattern esistente per API routes, hooks, components

### PATTERN DA SEGUIRE (copia dalla codebase esistente):

**API Route (esempio):**
```typescript
// app/api/grades/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const tenantId = session.user.tenantId;
  // ... query con tenantId OBBLIGATORIO
}
```

**Hook (esempio):**
```typescript
// lib/hooks/useGrades.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useGrades(classId: string, subjectId: string) {
  return useQuery({
    queryKey: ['grades', classId, subjectId],
    queryFn: async () => {
      const res = await fetch(`/api/grades?classId=${classId}&subjectId=${subjectId}`);
      if (!res.ok) throw new Error('Failed to fetch grades');
      return res.json();
    }
  });
}
```

---

## CHECKLIST FINALE

Prima di considerare il progetto COMPLETO:

```
□ Tutti i task del Blocco A completati (core scolastico)
□ Tutti i task del Blocco B completati (moduli esistenti)
□ Landing page professionale live
□ Almeno 3 articoli blog pubblicati
□ Almeno 2 mini tool funzionanti
□ SEO basics implementato (meta, sitemap, robots)
□ Demo mode funzionante
□ TypeScript compila senza errori
□ Test passano tutti
□ Performance: Lighthouse > 80 su tutte le metriche
□ Mobile responsive su tutti i device
□ i18n completo per tutte le nuove feature
□ Documentazione aggiornata
□ Docker production-ready
```

---

## NOTE PER DRILON

Questo prompt è progettato per essere dato a Claude Code (o a una nuova conversazione Claude) insieme alla repo e alla `GUIDA_SVILUPPO_GESTIONALI_V2.md`.

**Suggerimento strategico**: Esegui i task in sessioni. Ogni sessione = 1 blocco (A, B, C, D, E). Verifica tutto prima di passare al blocco successivo.

**Priorità assoluta**: Blocco A (voti, pagelle, materie). Senza queste feature il prodotto NON è un registro elettronico. È solo un gestionale generico per corsi.

**Differenziazione dal mercato**: Le feature del Blocco D (gamification, AI assistant, QR check-in) sono quelle che ti distinguono da Argo, ClasseViva, Axios. Nessuno le ha.