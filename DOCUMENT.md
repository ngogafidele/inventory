# Multi-Store System - Two Store Implementation Guide

## Overview

Your Inventory Management System has **one admin account** that manages **exactly two stores**:
- Store 1 (e.g., "Downtown", "Main Branch")
- Store 2 (e.g., "Mall", "Secondary Branch")

All data (products, sales, invoices, etc.) is scoped to a specific store.

---

## System Architecture

```
┌──────────────────────┐
│   Admin Account      │
│   (One user)         │
└──────────────────────┘
           │
           ├─ Can access both stores
           ├─ Can switch between stores
           ├─ Creates users for each store
           ├─ Manages inventory in both stores
           └─ Views separate analytics per store
           
┌──────────────┐         ┌──────────────┐
│   Store 1    │         │   Store 2    │
├──────────────┤         ├──────────────┤
│ Users        │         │ Users        │
│ Products     │         │ Products     │
│ Sales        │         │ Sales        │
│ Invoices     │         │ Invoices     │
│ Alerts       │         │ Alerts       │
│ Stock Adj.   │         │ Stock Adj.   │
│ Categories   │         │ Categories   │
└──────────────┘         └──────────────┘
```

---

## Database Schema Changes

### User Model with Store Assignment

```typescript
// lib/db/models/User.ts
import mongoose from 'mongoose';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;           // Hashed
  isAdmin: boolean;           // Only one admin
  isActive: boolean;
  role: 'admin' | 'manager' | 'staff';
  stores: ('store1' | 'store2')[]; // Which stores this user can access
  createdAt: Date;
  lastLogin?: Date;
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  role: { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
  stores: [{
    type: String,
    enum: ['store1', 'store2'],
    required: true
  }],
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
```

**Usage:**
- Admin: `stores: ['store1', 'store2']` (access both)
- Manager at Store 1: `stores: ['store1']`
- Manager at Store 2: `stores: ['store2']`
- Staff at both: `stores: ['store1', 'store2']`

### Product Model with Store Reference

```typescript
// lib/db/models/Product.ts
import mongoose from 'mongoose';

export interface IProduct {
  _id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  store: 'store1' | 'store2';  // Which store owns this product
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  store: {
    type: String,
    enum: ['store1', 'store2'],
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for faster queries by store
ProductSchema.index({ store: 1 });

export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
```

### Apply Same Pattern to All Models

For **Category**, **Sale**, **Invoice**, **Alert**, **StockAdjustment**:

```typescript
store: {
  type: String,
  enum: ['store1', 'store2'],
  required: true
}
```

Add index: `Schema.index({ store: 1 });`

---

## Session & Store Context

### Enhanced Session with Current Store

```typescript
// lib/auth/session.ts
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthSession {
  userId: string;
  email: string;
  isAdmin: boolean;
  role: string;
  stores: ('store1' | 'store2')[]; // User's accessible stores
  currentStore?: 'store1' | 'store2'; // Currently selected store
}

export function createToken(session: AuthSession): string {
  return jwt.sign(session, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthSession | null {
  try {
    return jwt.verify(token, SECRET) as AuthSession;
  } catch {
    return null;
  }
}

export function updateCurrentStore(session: AuthSession, store: 'store1' | 'store2'): AuthSession {
  // Verify user can access this store
  if (!session.stores.includes(store)) {
    throw new Error('User does not have access to this store');
  }
  return { ...session, currentStore: store };
}
```

---

## API Route Patterns for Multi-Store

### Store-Scoped GET Products

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { Product } from '@/lib/db/models/Product';

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request);
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get store from query params, default to first accessible store
    const store = request.nextUrl.searchParams.get('store') || session.currentStore || session.stores[0];

    // Verify user can access this store
    if (!session.stores.includes(store as 'store1' | 'store2')) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this store' },
        { status: 403 }
      );
    }

    // Fetch products for this store only
    const products = await Product.find({ store });

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
```

### Store-Scoped POST Product (Admin Only)

```typescript
// app/api/products/route.ts (POST method)
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { validateProductInput } from '@/lib/db/validators/product';
import { Product } from '@/lib/db/models/Product';

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request);
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: 'Admin only' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { store, ...productData } = body;

    // Validate store
    if (!['store1', 'store2'].includes(store)) {
      return NextResponse.json(
        { success: false, error: 'Invalid store' },
        { status: 400 }
      );
    }

    // Validate product data
    const validatedData = validateProductInput(productData);

    // Create product
    const product = await Product.create({
      ...validatedData,
      store,
    });

    return NextResponse.json(
      { success: true, data: product },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 400 }
    );
  }
}
```

---

## Frontend: Store Switcher Component

```typescript
// components/store-switcher.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface StoreSwitcherProps {
  currentStore: 'store1' | 'store2';
  availableStores: ('store1' | 'store2')[];
}

export function StoreSwitcher({ currentStore, availableStores }: StoreSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const handleStoreChange = async (newStore: 'store1' | 'store2') => {
    if (newStore === currentStore) return;

    setSwitching(true);
    try {
      // Update server session with new store
      const response = await fetch('/api/auth/switch-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: newStore }),
      });

      if (response.ok) {
        // Refresh page to load new store's data
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to switch store');
    } finally {
      setSwitching(false);
    }
  };

  const storeNames: Record<string, string> = {
    store1: 'Store 1',
    store2: 'Store 2',
  };

  return (
    <div className="flex gap-2">
      {availableStores.map((store) => (
        <button
          key={store}
          onClick={() => handleStoreChange(store)}
          disabled={switching || store === currentStore}
          className={`px-4 py-2 rounded ${
            store === currentStore
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
          }`}
        >
          {storeNames[store]}
        </button>
      ))}
    </div>
  );
}
```

### Use in Layout

```typescript
// app/(dashboard)/layout.tsx
import { StoreSwitcher } from '@/components/store-switcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get from session/context
  const currentStore = 'store1';
  const userStores = ['store1', 'store2'];

  return (
    <div>
      <nav className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h1>Inventory System</h1>
          <StoreSwitcher currentStore={currentStore} availableStores={userStores} />
        </div>
      </nav>
      {children}
    </div>
  );
}
```

---

## API Endpoint: Switch Store

```typescript
// app/api/auth/switch-store/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { createToken, updateCurrentStore } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request);
    if (!authorized || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { store } = await request.json();

    // Validate store choice
    if (!['store1', 'store2'].includes(store)) {
      return NextResponse.json(
        { success: false, error: 'Invalid store' },
        { status: 400 }
      );
    }

    // Update session with new store
    const updatedSession = updateCurrentStore(session, store);
    const newToken = createToken(updatedSession);

    const response = NextResponse.json({ 
      success: true, 
      store 
    });

    // Update secure cookie
    response.cookies.set('auth', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to switch store' },
      { status: 400 }
    );
  }
}
```

---

## Dashboard: Store-Specific Analytics

```typescript
// app/(dashboard)/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DashboardPage({
  searchParams,
}: {
  searchParams: { store?: string };
}) {
  const store = searchParams.store || 'store1';
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/dashboard/stats?store=${store}`);
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [store]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard - {store === 'store1' ? 'Store 1' : 'Store 2'}</h1>
      
      {/* Stats for current store */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Products" value={stats?.productCount} />
        <StatCard label="Total Sales" value={stats?.salesCount} />
        <StatCard label="Revenue" value={`$${stats?.revenue}`} />
        <StatCard label="Low Stock Items" value={stats?.lowStockCount} />
      </div>

      {/* Other dashboard content */}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-4 bg-white rounded shadow">
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
```

---

## Dashboard Stats API

```typescript
// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { Product } from '@/lib/db/models/Product';
import { Sale } from '@/lib/db/models/Sale';
import { Invoice } from '@/lib/db/models/Invoice';

export async function GET(request: NextRequest) {
  try {
    const { authorized, session } = await requireAuth(request);
    if (!authorized || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = request.nextUrl.searchParams.get('store') || session.currentStore || session.stores[0];

    // Verify access
    if (!session.stores.includes(store as 'store1' | 'store2')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get store-specific data
    const productCount = await Product.countDocuments({ store });
    const lowStockCount = await Product.countDocuments({ store, quantity: { $lt: 10 } });
    const salesCount = await Sale.countDocuments({ store });
    
    const sales = await Sale.aggregate([
      { $match: { store } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return NextResponse.json({
      success: true,
      data: {
        productCount,
        lowStockCount,
        salesCount,
        revenue: sales[0]?.total || 0,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
```

---

## Creating Users for Specific Stores

```typescript
// lib/db/validators/user.ts - Update CreateUserSchema
export const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'staff']),
  stores: z.array(z.enum(['store1', 'store2'])).min(1), // Which stores
  isActive: z.boolean().default(true),
});
```

### Create User with Store Assignment

```typescript
// app/api/users/route.ts (POST)
export async function POST(request: NextRequest) {
  try {
    const { authorized, session } = await requireAdmin(request);
    if (!authorized || !session) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = validateCreateUserInput(body);

    // Verify stores are valid
    if (!validatedData.stores.every(s => ['store1', 'store2'].includes(s))) {
      return NextResponse.json(
        { error: 'Invalid stores' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(validatedData.password);

    const user = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      password: hashedPassword,
      role: validatedData.role,
      stores: validatedData.stores, // Assign to specified stores
      isActive: validatedData.isActive,
    });

    return NextResponse.json(
      { success: true, data: { ...user.toObject(), password: undefined } },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 400 });
  }
}
```

---

## Key Points for Implementation

### 1. Always Filter by Store
Every query that fetches data must include `{ store }`:
```typescript
const products = await Product.find({ store: 'store1' });
const sales = await Sale.find({ store });
```

### 2. Always Verify User Has Store Access
Before returning data for a store, check:
```typescript
if (!session.stores.includes(store)) {
  return 403 Forbidden;
}
```

### 3. Store is Required in All Data Models
No product, sale, invoice, etc. without a store field.

### 4. Admin Can Access Both Stores
Admin has `stores: ['store1', 'store2']` and can switch between them.

### 5. Regular Users Access Only Their Assigned Store(s)
A staff member might only have `stores: ['store1']`.

---

## Validation Schema Update

```typescript
// lib/db/validators/user.ts
export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password too short'),
  role: z.enum(['admin', 'manager', 'staff']),
  stores: z.array(z.enum(['store1', 'store2'])).min(1, 'Must select at least one store'),
  isActive: z.boolean().default(true),
});

export const ProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().min(0),
  price: z.number().min(0),
  category: z.string().min(1),
  store: z.enum(['store1', 'store2']), // Required
});
```

---

## Summary

**Two-Store Setup:**
- Admin owns both stores
- Each store has separate data (products, sales, invoices, etc.)
- Admin can switch between stores
- Other users assigned to one or both stores
- All API queries filtered by store
- Store access verified on every request

This architecture ensures complete data isolation between stores while allowing admin to manage both from a single account.