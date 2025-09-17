# Copilot Instructions for InsegnaMi.pro Project

We are building a **InsegnaMi.pro** using **Next.js full-stack**.  
The system must support **two modes**:
- **Self-hosted**: single school instance (tenantId = 1, no Super-Admin, no billing)
- **SaaS multi-tenant**: multiple schools (tenants) with Super-Admin managing them

The mode is controlled via an environment variable:  
`MODE=self-hosted|saas`

---

## 🏗️ Project Setup
- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache & Queue**: Redis + BullMQ (email, pdf, background jobs)
- **UI**: TailwindCSS + Mantine (modern, responsive, accessible)
- **State management**: TanStack Query
- **Auth**: Auth.js with role-based access
- **Deployment**: Docker Compose (next-app, postgres, redis, worker, proxy with Caddy)
- **Ready for PWA** (mobile/tablet support)

---

## 🔑 Core Modules (common to self-host & SaaS)

### 1. Authentication & Roles
- JWT sessions with refresh tokens
- Roles: SuperAdmin (SaaS only), Admin, Teacher, Student, Parent
- Middleware guards based on role

### 2. Tenant Management (SaaS mode only)
- `Tenant` entity (id, name, slug/subdomain, plan, featureFlags, trialUntil)
- `UserTenant` (relation user ↔ tenant with role)
- Super-Admin panel:
  - Create/edit tenants
  - Assign Admins to tenants
  - Enable/disable modules
  - (Future) Billing & plans (Stripe)

### 3. User & Profile Management
- CRUD for users (Admin only in self-host, Super-Admin in SaaS)
- Profile page for each role
- Multi-tenant scope: all queries must be scoped by `tenantId`

### 4. Students, Teachers, Classes
- Entities: Student, Teacher, Class, Course
- CRUD operations
- Relations: Student ↔ Class ↔ Teacher
- Search, pagination, filtering

### 5. Courses & Lessons
- Courses with metadata (name, description, level)
- Lessons scheduled with date/time/room
- Recurring lessons
- Linked to teachers/students

### 6. Attendance
- Teachers mark presence/absence for each student
- Attendance reports per class and student
- Export attendance to PDF

### 7. Payments (basic in MVP)
- Admin records fees/payments manually
- Status: Pending, Paid, Overdue
- Reports: summary per class/student
- (Future SaaS) Stripe integration with webhooks

### 8. Communications
- Noticeboard for teachers, students, parents
- Admin posts announcements
- Notifications via email (queued)

### 9. Calendar & Events
- Central calendar per school
- Events: lessons, exams, activities
- Color-coded, responsive

### 10. Reports & Statistics
- Active students per class
- Attendance %
- Payments overview

---

## 🎨 Design & UX
- Tailwind + Mantine UI
- Sidebar navigation + topbar
- Mobile responsive
- Accessible (ARIA roles, keyboard navigation)
- Intuitive and beginner-friendly (for non-technical school staff)

---

## 📂 Project Structure
/app
  /auth
    login/page.tsx
    register/page.tsx        # usata solo per SaaS, disabilitata in self-host
  /dashboard
    layout.tsx               # layout con sidebar/topbar
    page.tsx                 # overview generale (dipende dal ruolo)
    /admin
      page.tsx               # pannello admin scuola (gestione utenti, corsi, pagamenti)
    /teacher
      page.tsx               # pannello docente (classi, lezioni, presenze)
    /student
      page.tsx               # pannello studente (calendario, comunicazioni)
    /parent
      page.tsx               # pannello genitore (presenze, pagamenti, avvisi)
  /api
    /auth
      route.ts               # login/logout (Auth.js)
    /users
      route.ts               # CRUD utenti
    /classes
      route.ts               # CRUD classi/corsi
    /lessons
      route.ts               # CRUD lezioni
    /attendance
      route.ts               # presenze
    /payments
      route.ts               # pagamenti
    /notices
      route.ts               # bacheca/avvisi
  /public
    /images                  # loghi, icone, placeholder
  /superadmin                # solo in modalità SaaS: gestione scuole/tenant
    page.tsx

/components
  /ui                        # bottoni, input, modali, tab, sidebar
  /forms                     # form riutilizzabili (studenti, docenti, pagamenti)
  /tables                    # tabelle con filtraggio/paginazione (TanStack Table)
  /charts                    # grafici (attendance %, pagamenti)
  Navbar.tsx
  Sidebar.tsx
  Calendar.tsx

/lib
  auth.ts                    # config Auth.js
  db.ts                      # Prisma client
  redis.ts                   # client Redis
  queue.ts                   # BullMQ setup
  email.ts                   # utilità per email (Brevo/SMTP)
  pdf.ts                     # generazione report PDF

/prisma
  schema.prisma              # definizione schema DB
  migrations/                # migrazioni Prisma

/scripts
  backup.sh                  # backup DB automatico
  restore.sh                 # restore DB da backup
  seed.ts                    # dati di esempio (es. scuola di inglese)

/docker
  Dockerfile                 # build app Next.js
  docker-compose.yml         # servizi: app, postgres, redis, worker, proxy
  caddy/Caddyfile            # configurazione reverse proxy + TLS

/tests
  /unit                      # test unitari
  /e2e                       # test end-to-end (Playwright)

/. github
  /workflows
    ci-cd.yml                # lint, test, build, deploy su staging/prod


---

## ⚙️ DevOps & CI/CD
- GitHub Actions pipeline:
  - Run tests & lint
  - Build Docker image
  - Push to registry
  - Deploy via SSH to Hetzner VPS
- Environments:
  - `quality` (staging VPS)
  - `production` (prod VPS)
- Database migrations with `prisma migrate deploy`
- Daily Postgres dump backup to Backblaze B2
- Test backup restore monthly on staging

---

## 🚀 Performance
- Prisma optimized queries
- Redis caching for heavy queries
- Pagination on all data tables
- Queue (BullMQ) for async tasks (emails, reports, pdf)
- Caddy reverse proxy with HTTPS and caching

---

## 🔮 Future Extensions
- Stripe integration (SaaS billing)
- Schema-per-tenant or DB-per-tenant (if needed at scale)
- Advanced analytics and dashboards
- PWA with offline support

