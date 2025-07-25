Helpful Commands:
Development:
- npm run dev - builds app locally
- npx prisma db push - sychronize local database with schema.prisma, will lose data
  - --force-reset - option to override current data
- npx prisma generate - generate the Prisma client allowing the app to interact with the db
- npx prisma studio - view the database locally in spreadsheet format

# Local Development Setup

This guide will walk you through setting up the IT Dashboard application locally on your machine.

## Prerequisites

- Node.js (v18 or higher)
- Git
- PostgreSQL

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd it-dashboard
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: PostgreSQL Setup

### On Mac

**Install PostgreSQL using Homebrew:**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH (for Apple Silicon Macs)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc

# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Initialize database if needed
initdb /opt/homebrew/var/postgres
```

**Alternative: Using Postgres.app**
1. Download from https://postgresapp.com/
2. Drag to Applications folder
3. Launch and click "Initialize"
4. Add to PATH:
```bash
echo 'export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### On Windows

**Install PostgreSQL:**
1. Download from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the postgres user
4. Add PostgreSQL to PATH:
   - Win + R → `sysdm.cpl` → Environment Variables
   - Edit PATH → Add: `C:\Program Files\PostgreSQL\14\bin`
   - Restart Command Prompt/PowerShell

**Start PostgreSQL service:**
```cmd
net start postgresql-x64-14
```

### Verify PostgreSQL Installation

```bash
# Check version
psql --version

# Test connection
psql postgres
```

## Step 4: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create the database (inside psql)
CREATE DATABASE "it-dashboard";

# Exit psql
\q
```

**Verify database creation:**
```bash
# List databases
psql -l

# Connect to your new database
psql it-dashboard
```

## Step 5: Environment Configuration

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://localhost:5432/it-dashboard
# Or with credentials:
# DATABASE_URL=postgresql://username:password@localhost:5432/it-dashboard
```

## Step 6: Prisma Setup

```bash
# Generate Prisma client
npx prisma generate

# Push database schema to your database
npx prisma db push

# Optional: Seed the database with initial data
npx prisma db seed
```

## Step 7: Start Development Server

```bash
npm run dev
```

The application should now be running at `http://localhost:3000`

## Useful Commands

```bash
# Prisma operations
npx prisma studio              # Open Prisma Studio (database GUI)
npx prisma db push            # Push schema changes to database  
npx prisma generate           # Regenerate Prisma client
npx prisma migrate dev        # Create and apply new migration

psql it-dashboard              # Connect to database
psql -l                       # List all databases
\dt                           # List tables (inside psql)
\q                            # Exit psql

# Development
npm run dev                   # Start development server
npm run build                 # Build for production
npm run lint                  # Run linting
npm test                      # Run tests

# PostgreSQL service management
# Mac:
brew services start postgresql
brew services stop postgresql
brew services restart postgresql

# Windows:
net start postgresql-x64-14
net stop postgresql-x64-14
```

## Next Steps

- Familiarize yourself with the project structure
- Review the API endpoints in `/pages/api/`
- Check the database schema in `/prisma/schema.prisma`
- Read the component documentation in `/components/`

## Getting Help

If you encounter issues:
1. Verify all prerequisites are installed
2. Ensure PostgreSQL is running
3. Check the `.env` file configuration
4. Reach out to the development team