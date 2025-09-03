# Agency Finance Backend

Multi-tenant backend for agencies/businesses. Each agency has its own data and users. Roles:
- **SUPER_ADMIN**: creates agencies, assigns agency admins, global visibility
- **AGENCY_ADMIN**: manages users and records for their agency
- **PARTNER / ACCOUNTANT**: can create/read records; updates/deletes limited

## Tech
- Node.js + Express
- MongoDB + Mongoose
- JWT Auth (Bearer token)
- Role-based Access Control
- Aggregation reports (income, expenses, profit)

## Quick Start

```bash
cp .env.example .env
# edit .env with your Mongo URI and secrets

npm install
npm run seed:superadmin
npm run dev
```

Server: `http://localhost:${PORT||4000}`

### Auth
- `POST /api/auth/login` → `{ email, password }`

### Agencies (SUPER_ADMIN)
- `POST /api/agencies` → `{ name, code, address?, phone?, admin?: { name,email,password } }`
- `GET /api/agencies`
- `GET /api/agencies/:id`
- `PATCH /api/agencies/:id`
- `DELETE /api/agencies/:id`
- `POST /api/agencies/:id/admin` → create agency admin

### Users (AGENCY_ADMIN or SUPER_ADMIN)
- `POST /api/users` → `{ name, email, password, role }` (agency inferred from requester; SUPER can pass `agency`)
- `GET /api/users` (SUPER can filter `?agencyId=`)
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### Records (tenant scoped)
- `POST /api/records` → `{ customerName, typeOfService, sellingPrice, buyingPrice, expenses?, notes?, agency? }`
  - `commission = sellingPrice - buyingPrice` (auto)
- `GET /api/records?from=YYYY-MM-DD&to=YYYY-MM-DD&type=flight`
- `GET /api/records/:id`
- `PATCH /api/records/:id`
- `DELETE /api/records/:id`

### Reports
- `GET /api/reports/summary?from&to&type` →
  ```json
  {
    "totalSelling": 0,
    "totalBuying": 0,
    "totalExpenses": 0,
    "totalCommission": 0,
    "totalIncome": 0,    // == totalCommission
    "totalProfit": 0,    // totalCommission - totalExpenses
    "count": 0
  }
  ```
- `GET /api/reports/by-service?from&to` → array per `typeOfService` with the same metrics.

## Notes
- All data is **agency-scoped**. SUPER_ADMIN can pass `?agencyId=` to query another tenant.
- For production: enable HTTPS, rotate JWT secrets, validate inputs more strictly, add rate limiting.
