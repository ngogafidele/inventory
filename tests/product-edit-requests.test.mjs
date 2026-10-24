import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const require = createRequire(import.meta.url)
const testDirectory = path.dirname(fileURLToPath(import.meta.url))

// Execute the real handlers with an isolated database/auth boundary. No live data.
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(testDirectory, "..", relative)
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const localRequire = (name) => {
    if (name in mocks) return mocks[name]
    if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`, mocks, cache)
    return require(name)
  }
  new Function("require", "module", "exports", code)(localRequire, module, module.exports)
  return module.exports
}

const { ProductEditSchema, productEditSnapshot, sameProductEdit } = load("lib/product-edit.ts")
const productId = "507f1f77bcf86cd799439011"
const details = { name: "Soda", unit: "bottle", packUnits: [], costUnit: "bottle", lowStockThreshold: 5, costPrice: 100, price: 150 }

function fixture({ admin = true, store = "store2" } = {}) {
  const state = {
    product: { ...details, _id: productId, store: "store2", sku: "SODA", quantity: 20 },
    request: { ...details, _id: "request1", kind: "edit", store: "store2", status: "pending", productId, original: { ...details } },
    created: null,
  }
  const session = { userId: productId, name: "Operator", isAdmin: admin }
  class ProductInputError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
  const dbSession = {
    async withTransaction(work) {
      const before = structuredClone(state)
      try { return await work() } catch (error) { Object.assign(state, before); throw error }
    }, async endSession() {},
  }
  const mocks = {
    "@/lib/auth/middleware": {
      requireAuth: async () => ({ authorized: true, session }),
      requireAdmin: async () => ({ authorized: admin, session }),
    },
    "@/lib/auth/session": { resolveStoreFromRequest: () => store },
    "@/lib/db/connection": { connectToDatabase: async () => ({ startSession: async () => dbSession }) },
    "@/lib/db/alerts": { syncLowStockAlert: async () => {} },
    "@/lib/db/products": {
      ProductInputError, productNameExists: async () => false, isDuplicateProductNameError: () => false,
      checkPackUnitsAllowed: (store, input) => { if (store === "store1" && input.packUnits.length) throw new ProductInputError("Package units not allowed") },
      createProduct: async ({ input }) => {
        assert.notEqual(state.request.kind, "edit", "Edit must not create a product")
        state.created = input
        return { ...input, _id: productId, sku: "NEW" }
      },
    },
    "@/lib/db/product-requests": { serializeProductRequest: (record) => record },
    "@/lib/db/models/Product": { Product: {
      findOne: (filter) => {
        const value = state.product && filter.store === state.product.store && String(filter._id) === productId ? state.product : null
        return { then: (resolve) => Promise.resolve(value).then(resolve), session: async () => value }
      },
      findOneAndUpdate: async (_filter, update) => { Object.assign(state.product, update.$set); return state.product },
    } },
    "@/lib/db/models/ProductRequest": { ProductRequest: {
      create: async (value) => { state.created = value; return { toObject: () => value } },
      findOneAndUpdate: async (filter, update) => {
        if (state.request.status !== filter.status || state.request.store !== filter.store) return null
        Object.assign(state.request, update); return state.request
      },
      updateOne: async (_filter, update) => Object.assign(state.request, update.$set),
    } },
  }
  const submit = load("app/api/product-requests/route.ts", mocks).POST
  const approve = load("app/api/product-requests/[id]/approve/route.ts", mocks).POST
  const reject = load("app/api/product-requests/[id]/reject/route.ts", mocks).POST
  const request = (body) => ({ json: async () => body })
  return {
    state,
    submit: (changes = { ...details, price: 175 }) => submit(request({ kind: "edit", productId, original: details, changes })),
    approve: (changes = { ...details, price: 180 }) => approve(request(changes), { params: Promise.resolve({ id: "request1" }) }),
    reject: () => reject(request({ reason: "Keep the current price" }), { params: Promise.resolve({ id: "request1" }) }),
  }
}

test("edit validation excludes quantity, category and arbitrary fields", () => {
  for (const field of ["quantity", "categoryId", "store", "sku"]) {
    assert.equal(ProductEditSchema.safeParse({ ...details, [field]: 10 }).success, false)
  }
  assert.equal(ProductEditSchema.safeParse({ ...details, costUnit: "missing" }).success, false)
  assert.equal(ProductEditSchema.safeParse({ ...details, packUnits: [{ name: "bottle", factor: 2, price: 10 }] }).success, false)
})

test("snapshots ignore stock movement but detect price and unit changes", () => {
  assert.ok(sameProductEdit(productEditSnapshot({ ...details, quantity: 20 }), productEditSnapshot({ ...details, quantity: 3 })))
  assert.equal(sameProductEdit(details, { ...details, price: 200 }), false)
  assert.equal(sameProductEdit(details, { ...details, unit: "pcs" }), false)
})

test("staff submission stores a proposal without changing the product", async () => {
  const f = fixture({ admin: false })
  assert.equal((await f.submit()).status, 201)
  assert.equal(f.state.product.price, 150)
  assert.equal(f.state.product.quantity, 20)
  assert.equal(f.state.created.price, 175)
  assert.deepEqual(f.state.created.original, details)
})

test("stale forms and cross-store submissions fail", async () => {
  const f = fixture()
  f.state.product.price = 200
  assert.equal((await f.submit()).status, 409)
  assert.equal((await fixture({ store: "store1" }).submit()).status, 404)
})

test("staff cannot approve, including via direct API", async () => {
  const f = fixture({ admin: false })
  assert.equal((await f.approve()).status, 403)
  assert.equal(f.state.request.status, "pending")
})

test("admin can amend the proposal; approval preserves live stock and records final values", async () => {
  const f = fixture()
  f.state.product.quantity = 7
  assert.equal((await f.approve()).status, 201)
  assert.equal(f.state.product.price, 180)
  assert.equal(f.state.product.quantity, 7)
  assert.equal(f.state.request.approvedChanges.price, 180)
  assert.equal(f.state.request.reviewedBy, productId)
  assert.equal((await f.approve()).status, 409)
})

test("conflicts, removed products and invalid approvals leave requests pending", async () => {
  const f = fixture()
  f.state.product.price = 200
  assert.equal((await f.approve()).status, 409)
  assert.equal(f.state.request.status, "pending")
  f.state.product = null
  assert.equal((await f.approve()).status, 404)
  assert.equal(f.state.request.status, "pending")
  const invalid = fixture()
  assert.equal((await invalid.approve({ ...details, quantity: 500 })).status, 400)
  assert.equal(invalid.state.request.status, "pending")
  assert.equal(invalid.state.product.quantity, 20)
})

test("cross-store approval cannot claim a request", async () => {
  const f = fixture({ store: "store1" })
  assert.equal((await f.approve()).status, 409)
  assert.equal(f.state.request.status, "pending")
})

test("admin rejection records a reason without changing the product and prevents approval", async () => {
  const f = fixture()
  assert.equal((await f.reject()).status, 200)
  assert.equal(f.state.request.rejectionReason, "Keep the current price")
  assert.equal(f.state.request.status, "rejected")
  assert.equal(f.state.product.price, 150)
  assert.equal((await f.approve()).status, 409)
  assert.equal((await fixture({ admin: false }).reject()).status, 403)
})

test("legacy new-product requests still create a product on approval", async () => {
  const f = fixture()
  delete f.state.request.kind
  assert.equal((await f.approve({ ...details, quantity: 25 })).status, 201)
  assert.equal(f.state.created.quantity, 25)
  assert.equal(f.state.request.status, "approved")
})

test("admin corrections to a new-product request become the created product", async () => {
  const f = fixture()
  f.state.request.kind = "create"
  const corrected = { ...details, name: "Corrected soda", price: 225, costPrice: 125, quantity: 30 }
  assert.equal((await f.approve(corrected)).status, 201)
  assert.equal(f.state.created.name, corrected.name)
  assert.equal(f.state.created.price, corrected.price)
  assert.equal(f.state.created.costPrice, corrected.costPrice)
  assert.equal(f.state.created.quantity, corrected.quantity)
  assert.equal(f.state.request.status, "approved")
})

test("rejecting a new-product request does not create a product", async () => {
  const f = fixture()
  f.state.request.kind = "create"
  assert.equal((await f.reject()).status, 200)
  assert.equal(f.state.created, null)
  assert.equal(f.state.request.status, "rejected")
  assert.equal((await f.approve({ ...details, quantity: 30 })).status, 409)
})

function notificationFixture({ admin = true, store = "store2", fail = false } = {}) {
  const rows = [
    { _id: "new", name: "New soda", store: "store2", status: "pending", submittedBy: { name: "Staff" } },
    { _id: "edit", name: "Existing soda", kind: "edit", store: "store2", status: "pending", submittedBy: null },
    { _id: "done", name: "Approved", store: "store2", status: "approved" },
    { _id: "other", name: "Other branch", store: "store1", status: "pending" },
  ]
  let queryCount = 0
  const { GET } = load("app/api/product-requests/notifications/route.ts", {
    "@/lib/auth/middleware": { requireAdmin: async () => ({ authorized: admin, session: { isAdmin: admin } }) },
    "@/lib/auth/session": { resolveStoreFromRequest: () => store },
    "@/lib/db/connection": { connectToDatabase: async () => {} },
    "@/lib/db/models/User": {},
    "@/lib/db/models/ProductRequest": { ProductRequest: { find: (filter) => {
      queryCount++
      if (fail) throw new Error("Database unavailable")
      const query = {
        select: () => query, sort: () => query, populate: () => query,
        lean: async () => rows.filter((row) => row.store === filter.store && row.status === filter.status),
      }
      return query
    } } },
  })
  return { get: () => GET({}), queryCount: () => queryCount, rows }
}

test("notifications include pending new and edit requests only in the authorized branch", async () => {
  const f = notificationFixture()
  const response = await f.get()
  assert.equal(response.status, 200)
  const { data } = await response.json()
  assert.deepEqual(data.map(({ id, kind }) => ({ id, kind })), [{ id: "new", kind: "create" }, { id: "edit", kind: "edit" }])
  assert.equal(data[0].submittedByName, "Staff")
  assert.equal(data[1].submittedByName, "Unknown user")
  f.rows[0].status = "approved"
  f.rows[1].status = "rejected"
  assert.deepEqual((await (await f.get()).json()).data, [])
})

test("non-admin and unauthorized-store notification requests cannot read requests", async () => {
  for (const options of [{ admin: false }, { store: null }]) {
    const f = notificationFixture(options)
    assert.equal((await f.get()).status, 403)
    assert.equal(f.queryCount(), 0)
  }
})

test("notification failures return an error rather than a false empty inbox", async () => {
  const response = await notificationFixture({ fail: true }).get()
  assert.equal(response.status, 500)
  assert.equal((await response.json()).success, false)
})

test("products page passes a notification target only to an admin in the active branch", async () => {
  for (const isAdmin of [true, false]) {
    const page = load("app/(dashboard)/products/page.tsx", {
      "@/components/products/products-manager": { ProductsManager: () => null },
      "@/lib/auth/server": { requireServerSession: async () => ({ isAdmin, userId: "user" }), getCurrentStore: () => "store2" },
      "@/lib/db/connection": { connectToDatabase: async () => {} },
      "@/lib/db/models/User": {},
      "@/lib/db/models/Product": { Product: { find: () => ({ lean: async () => [] }) } },
      "@/lib/db/models/ProductReceipt": { ProductReceipt: { find: () => ({ sort: () => ({ lean: async () => [] }) }) } },
      "@/lib/db/product-requests": { loadProductRequests: async ({ store }) => { assert.equal(store, "store2"); return [] } },
    }).default
    const element = await page({ searchParams: Promise.resolve({ reviewRequest: "request1" }) })
    assert.equal(element.props.initialReviewRequestId, isAdmin ? "request1" : undefined)
    assert.equal(element.key, "store2:request1")
  }
})
