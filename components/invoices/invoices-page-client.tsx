"use client"

// Coordinates sales-invoice and proforma tabs for the billing screen.
import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { StoreKey } from "@/lib/auth/session"
import { ProformaInvoicesList } from "@/components/invoices/proforma-list"
import { SalesInvoicesList, type SaleInvoiceSaleOption } from "@/components/invoices/sales-list"
import { DeliveryNotesList } from "@/components/invoices/delivery-notes-list"

type ActiveTab = "sales" | "proforma" | "delivery-notes"

export function InvoicesPageClient({
  storeId,
  canCreateInvoices,
  canManageInvoices,
  canDeleteInvoices,
  sales,
}: {
  storeId: StoreKey
  canCreateInvoices: boolean
  canManageInvoices: boolean
  canDeleteInvoices: boolean
  sales: SaleInvoiceSaleOption[]
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("sales")
  const [newSalesInvoiceSignal, setNewSalesInvoiceSignal] = useState(0)
  const [newProformaSignal, setNewProformaSignal] = useState(0)
  const [newDeliveryNoteSignal, setNewDeliveryNoteSignal] = useState(0)

  const tabs: Array<{ value: ActiveTab; label: string }> = [
    { value: "sales", label: "Sales invoices" },
    { value: "proforma", label: "Proforma invoices" },
    { value: "delivery-notes", label: "Delivery notes" },
  ]

  const createButtonLabel =
    activeTab === "sales"
      ? "New invoice"
      : activeTab === "proforma"
        ? "New proforma"
        : "New delivery note"

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Billing
          </p>
          <h2 className="text-2xl font-semibold">Invoices</h2>
        </div>
        {canCreateInvoices ? (
          <Button
            onClick={() => {
              if (activeTab === "sales") {
                setNewSalesInvoiceSignal((value) => value + 1)
                return
              }

              if (activeTab === "proforma") {
                setNewProformaSignal((value) => value + 1)
                return
              }

              setNewDeliveryNoteSignal((value) => value + 1)
            }}
          >
            <Plus className="size-4" />
            {createButtonLabel}
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-1">
        <div className="grid gap-1 md:grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "min-h-12 rounded-md px-4 py-3 text-base font-semibold text-muted-foreground transition hover:bg-background/70 hover:text-foreground",
                activeTab === tab.value &&
                  "bg-primary text-primary-foreground shadow-sm"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "sales" ? (
        <SalesInvoicesList
          storeId={storeId}
          sales={sales}
          canCreateInvoices={canCreateInvoices}
          canManageInvoices={canManageInvoices}
          canDeleteInvoices={canDeleteInvoices}
          newInvoiceSignal={newSalesInvoiceSignal}
        />
      ) : activeTab === "proforma" ? (
        <ProformaInvoicesList
          storeId={storeId}
          canCreateInvoices={canCreateInvoices}
          canManageInvoices={canManageInvoices}
          canDeleteInvoices={canDeleteInvoices}
          newInvoiceSignal={newProformaSignal}
        />
      ) : (
        <DeliveryNotesList
          storeId={storeId}
          sales={sales}
          canCreateInvoices={canCreateInvoices}
          canManageInvoices={canManageInvoices}
          canDeleteInvoices={canDeleteInvoices}
          newDeliveryNoteSignal={newDeliveryNoteSignal}
        />
      )}
    </div>
  )
}
