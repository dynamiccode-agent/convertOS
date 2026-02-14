# ConvertOS - Meta Ads Intelligence Platform

A Next.js SaaS application for Meta Ads campaign intelligence and optimization.

![ConvertOS](https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80)

## 🚀 Features

- ✅ Beautiful sign-in page with glassmorphism UI
- ✅ NextAuth authentication with credentials provider
- ✅ Protected dashboard routes
- ✅ PostgreSQL database via Neon
- ✅ Prisma ORM
- ✅ TypeScript & Tailwind CSS
- ✅ Meta Ads API integration ready
- 🚧 Real-time campaign analytics (coming soon)
- 🚧 Multi-account management (coming soon)
- 🚧 Ad performance optimization (coming soon)

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Deployment**: Vercel

## 📦 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/dynamiccode-agent/convertOS.git
cd convertOS

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push database schema
npx prisma db push

# Seed database with default user
npx prisma db seed

# Run development server
npm run dev

# Open http://localhost:3000
```

### Default Login

**Email**: tyler@dynamiccode.com.au  
**Password**: Dynamic

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions to Vercel with custom domain setup.

### Environment Variables

Required environment variables:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://convertos.cloud"
NEXTAUTH_SECRET="your-secret-here"
META_ACCESS_TOKEN="your-meta-token"
META_API_VERSION="v24.0"
META_APP_SECRET="your-app-secret"
```

See [VERCEL_ENV.md](./VERCEL_ENV.md) for complete list and values.

## 📁 Project Structure

```
convertos/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed script
├── src/
│   ├── app/
│   │   ├── api/auth/          # NextAuth API routes
│   │   ├── auth/signin/       # Sign-in page
│   │   ├── dashboard/         # Protected dashboard
│   │   └── ...
│   ├── components/ui/         # UI components
│   └── lib/                   # Utilities & config
├── .env                       # Environment variables (local)
├── .env.example               # Environment template
├── DEPLOYMENT.md              # Deployment guide
└── VERCEL_ENV.md             # Vercel env vars
```

## 🔐 Authentication

ConvertOS uses NextAuth.js with:
- Credentials provider (email/password)
- JWT session strategy
- Prisma adapter for database sessions
- Protected routes with middleware

## 🗄️ Database Schema

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?
  name          String?
  accounts      Account[]
  sessions      Session[]
}

model Account { ... }
model Session { ... }
model VerificationToken { ... }
```

## 📝 Development

### Commands

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm start

# Lint
npm run lint

# Database
npx prisma studio        # Open database GUI
npx prisma generate      # Generate Prisma client
npx prisma db push       # Push schema to database
npx prisma db seed       # Seed database
```

### Adding Features

1. Create React components in `src/components/`
2. Add pages in `src/app/`
3. Update database schema in `prisma/schema.prisma`
4. Run `npx prisma db push` to apply changes
5. Generate types with `npx prisma generate`

## 🔗 Links

- **Production**: https://convertos.cloud (after deployment)
- **GitHub**: https://github.com/dynamiccode-agent/convertOS
- **Database**: Neon PostgreSQL
- **Deployment**: Vercel

## 📄 License

Proprietary - Dynamic Code

## 🤝 Contributing

This is a private project for Dynamic Code. For issues or feature requests, contact the development team.

## 🆘 Support

For deployment help, see [DEPLOYMENT.md](./DEPLOYMENT.md)  
For environment variables, see [VERCEL_ENV.md](./VERCEL_ENV.md)

---

**Built with ⚡ by Dynamic Code**
