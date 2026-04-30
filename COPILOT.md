# Copilot Instructions - Inventory Management System

## Project Overview
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB Atlas with Mongoose
- ** Icons: lucide react
- **Styling**: Tailwind CSS
- **State Management**: React hooks + Server Components
- **API Pattern**: Next.js Route Handlers
- **Validation**: Zod for schema validation
- **HTTP Client**: fetch API (built-in)

## Features to Implement
1. **Dashboard** - Overview analytics and key metrics
2. **Users Management** - Admin creates accounts and manages access (no self-signup)
3. **Products Management** - Product catalog with no images
4. **Categories** - Product category organization
5. **Sales** - Record and track sales transactions, Selling prices can be adjusted
6. **Invoices** - Generate and manage invoices
7. **Alerts** - Low stock and other system alerts
8. **Stock Adjustments** - Manual inventory adjustments with reasons

## Authentication & Authorization
- **Single Admin Account** - One master admin account (created during setup)
- **User Creation** - Only admin can create new user accounts
- **Access Control** - Admin assigns roles and permissions to users
- **Session Management** - Secure session/JWT for authenticated requests
- **Protected Routes** - All dashboard routes require authentication
- **Role-Based Access** - Admin can grant different permission levels, only admin can view analytics, add products and categories.

---

## Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts                  # POST - Admin login
│   │   │   ├── logout/route.ts                 # POST - Logout
│   │   │   ├── me/route.ts                     # GET - Current user
│   │   │   └── setup/route.ts                  # POST - Initial admin setup (run once)
│   │   │
│   │   ├── users/
│   │   │   ├── route.ts              # GET all, POST create (admin only)
│   │   │   └── [id]/
│   │   │       └── route.ts          # GET one, PUT update, DELETE (admin only)
│   │   │
│   │   ├── products/
│   │   ├── categories/
│   │   ├── sales/
│   │   ├── invoices/
│   │   ├── alerts/
│   │   ├── stock-adjustments/
│   │   └── auth/                     # Authentication routes
│   │
│   ├── (dashboard)/                  # Grouped routes
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # /dashboard
│   │   ├── products/
│   │   │   ├── page.tsx              # /products
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # /products/[id]
│   │   │   └── new/
│   │   │       └── page.tsx          # /products/new
│   │   ├── users/
│   │   ├── categories/
│   │   ├── sales/
│   │   ├── invoices/
│   │   ├── alerts/
│   │   └── stock-adjustments/
│   │
│   ├── layout.tsx                    # Root layout with navigation
│   ├── page.tsx                      # Home/login
│   └── globals.css
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── data-table.tsx
│   │   └── [other ui components]
│   │
│   ├── dashboard/
│   │   ├── stats-card.tsx
│   │   ├── recent-sales.tsx
│   │   └── chart-components.tsx
│   │
│   ├── forms/
│   │   ├── user-form.tsx
│   │   ├── product-form.tsx
│   │   ├── sales-form.tsx
│   │   └── [other forms]
│   │
│   ├── tables/
│   │   ├── users-table.tsx
│   │   ├── products-table.tsx
│   │   └── [other tables]
│   │
│   └── navigation/
│       └── sidebar.tsx
│
├── lib/
│   ├── db/
│   │   ├── connection.ts             # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Product.ts
│   │   │   ├── Category.ts
│   │   │   ├── Sale.ts
│   │   │   ├── Invoice.ts
│   │   │   ├── Alert.ts
│   │   │   └── StockAdjustment.ts
│   │   └── validators/
│   │       ├── user.ts               # Zod schemas
│   │       ├── product.ts
│   │       └── [other validators]
│   │
│   ├── auth/
│   │   ├── session.ts                # Session/JWT management
│   │   ├── middleware.ts             # Auth middleware
│   │   ├── hash.ts                   # Password hashing (bcrypt)
│   │   └── permissions.ts            # Role & permission checks
│   │
│   ├── utils/
│   │   ├── format.ts                 # Formatting utilities
│   │   ├── calculations.ts           # Business logic
│   │   ├── api-client.ts             # Fetch wrapper
│   │   └── constants.ts              # App constants
│   │
│   ├── hooks/
│   │   ├── useFetch.ts               # Custom hook for API calls
│   │   ├── useAlert.ts               # Alert notifications
│   │   └── [other custom hooks]
│   │
│   └── types.ts                      # Global type definitions
│
├── types/
│   ├── index.ts                      # Re-export all types
│   ├── user.ts
│   ├── product.ts
│   ├── sale.ts
│   └── [other types]
│
├── public/                           # Static assets
├── .env.local                        # Environment variables
├── .env.example                      # Template for env vars
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

---

