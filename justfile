# Stringer — research desk for paid-newsletter operators.
# Single source of truth for commands; agents and humans use these, never raw pnpm/docker.
# Until M0 bootstraps the workspace, guarded recipes fail with a pointer to DESIGN.md.

# List available recipes
default:
    @just --list

# (internal) Fail with guidance when the workspace is not bootstrapped yet
_guard:
    @if [ ! -f package.json ]; then echo "stringer: package.json not found — workspace not bootstrapped yet."; echo "This is a docs-only scaffold. See DESIGN.md > Milestones > M0 for the bootstrap plan."; exit 1; fi

# Enable corepack and install workspace dependencies
setup: _guard
    corepack enable
    pnpm install

# Run dev servers (Next.js web + Inngest dev)
dev: _guard
    pnpm dev

# Start local Postgres with pgvector (docker compose service: postgres)
db-up: _guard
    docker compose up -d postgres

# Stop local Postgres
db-down: _guard
    docker compose down

# Apply Drizzle migrations (packages/db)
migrate: _guard
    pnpm --filter @stringer/db migrate

# Run unit/integration tests (vitest)
test: _guard
    pnpm test

# Run Playwright end-to-end tests
e2e: _guard
    pnpm e2e

# Lint the workspace (ESLint)
lint: _guard
    pnpm lint

# Format the workspace (Prettier)
format: _guard
    pnpm format

# Type-check the workspace (tsc --noEmit)
typecheck: _guard
    pnpm typecheck

# Production build
build: _guard
    pnpm build

# Full CI gate: lint + typecheck + test + build (mirrors GitHub Actions)
ci: lint typecheck test build
