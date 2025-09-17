# InsegnaMi.pro

Modern School Management & Electronic Register System built with Next.js 15, TypeScript, and Prisma.

## 🚀 Features

- **Multi-tenant Architecture**: Support for both self-hosted and SaaS modes
- **Role-based Access Control**: SuperAdmin, Admin, Teacher, Student, and Parent roles
- **Student Management**: Complete student lifecycle management
- **Teacher Management**: Teacher profiles and class assignments
- **Class & Course Management**: Flexible course and class creation
- **Attendance Tracking**: Digital attendance with detailed reporting
- **Payment Management**: Fee tracking and payment records
- **Communications**: Notice board and announcements
- **Calendar & Events**: Integrated calendar with lesson scheduling
- **Reporting**: Comprehensive reports and analytics
- **Mobile-ready**: Responsive design with PWA capabilities

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis with BullMQ for background jobs
- **UI**: TailwindCSS + Mantine components
- **Authentication**: Auth.js (NextAuth)
- **State Management**: TanStack Query
- **Deployment**: Docker Compose with Caddy proxy

## 🏗️ Project Structure

```
insegnami/
├── app/                    # Next.js App Router pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard layouts and pages
│   ├── api/               # API routes
│   └── superadmin/        # SaaS mode admin panel
├── components/            # React components
│   ├── ui/                # Base UI components
│   ├── forms/             # Form components
│   ├── tables/            # Data table components
│   └── charts/            # Chart components
├── lib/                   # Utility libraries
│   ├── auth.ts           # Auth configuration
│   ├── db.ts             # Database client
│   ├── redis.ts          # Redis client
│   └── config.ts         # App configuration
├── prisma/               # Database schema and migrations
├── scripts/              # Utility scripts
├── docker/               # Docker configuration
└── tests/                # Test files
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- Docker Desktop (for local development)
- Git

### Quick Start (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd insegnami
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Run the development setup (Windows):
```bash
npm run dev:setup
```

This will:
- Start PostgreSQL, Redis, and MailHog with Docker
- Set up the database schema
- Seed with sample data
- Show you the login credentials

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Manual Setup

If you prefer manual setup or have existing services:

1. Start required services (PostgreSQL, Redis)
2. Configure `.env.local` with your database and Redis URLs
3. Setup the database:
```bash
npm run db:push
npm run db:seed
```
4. Start the development server:
```bash
npm run dev
```

### Default Login Credentials

After running the seed, you can login with any of these accounts (password: `password`):

- **Admin**: admin@englishplus.it
- **Teacher**: teacher1@englishplus.it, teacher2@englishplus.it  
- **Student**: student@englishplus.it
- **Parent**: parent@englishplus.it

### Development Services

- **Application**: http://localhost:3000
- **MailHog (Email testing)**: http://localhost:8025
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 🐳 Docker Deployment

The application includes a complete Docker setup with all required services:

```bash
cd docker
docker-compose up -d
```

This will start:
- Next.js application
- PostgreSQL database
- Redis server
- Background worker
- Caddy reverse proxy with HTTPS

## 🔧 Configuration

### Mode Configuration

The application supports two modes:

- **Self-hosted**: Single school instance (set `MODE=self-hosted`)
- **SaaS**: Multi-tenant with multiple schools (set `MODE=saas`)

### Environment Variables

See `.env.example` for all available configuration options.

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Type checking
npm run type-check
```

## 📝 Scripts

- `npm run dev:setup` - Complete development environment setup (Windows)
- `npm run dev:services` - Start only Docker services (PostgreSQL, Redis, MailHog)
- `npm run dev:stop` - Stop Docker services
- `npm run dev` - Start development server
- `npm run build` - Build production application  
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Input validation with Zod
- CSRF protection
- Rate limiting
- Secure headers with Caddy

## 📊 Performance

- Server-side rendering with Next.js
- Redis caching for database queries
- Background job processing with BullMQ
- Optimized database queries with Prisma
- Image optimization with Next.js

## 🌍 Internationalization

The application is built with Italian as the primary language but is structured to support multiple languages in the future.

## 📱 PWA Support

The application is PWA-ready with:
- Offline functionality
- Push notifications
- Mobile app-like experience

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Email: support@insegnami.pro
- Documentation: Coming soon
- Issues: Use GitHub issues

## 🗺️ Roadmap

- [ ] Advanced analytics and reporting
- [ ] Stripe integration for SaaS billing
- [ ] Mobile applications (iOS/Android)
- [ ] Advanced exam management
- [ ] Grade book functionality
- [ ] Parent portal enhancements
- [ ] Multi-language support
- [ ] API documentation
- [ ] Plugin system
