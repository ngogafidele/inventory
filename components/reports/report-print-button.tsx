"use client"

import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STORE_LABELS, type StoreKey } from "@/lib/utils/constants"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

type StoreReport = {
  store: StoreKey
  products: number
  lowStock: number
  inventoryCost: number
  inventoryRetail: number
  sales: number
  revenue: number
  grossProfit: number
  invoices: number
  unpaidInvoices: number
  outstanding: number
  adjustments: number
}

type TopMovingProduct = {
  sku: string
  name: string
  unit: string
  soldQuantity: number
  revenue: number
  grossProfit: number
}

type RecentSale = {
  _id: string
  store: StoreKey
  createdAt?: string
  totalAmount: number
  items: Array<{
    name: string
    sku: string
    unit: string
    quantity: number
  }>
}

type ReportPrintButtonProps = {
  store: StoreKey
  fromLabel: string
  toLabel: string
  reports: StoreReport[]
  topMovingProducts: TopMovingProduct[]
  recentSales: RecentSale[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDateTime(date: string | undefined) {
  if (!date) return "-"

  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sumReports(reports: StoreReport[]) {
  return reports.reduce(
    (total, report) => ({
      products: total.products + report.products,
      lowStock: total.lowStock + report.lowStock,
      inventoryCost: total.inventoryCost + report.inventoryCost,
      inventoryRetail: total.inventoryRetail + report.inventoryRetail,
      sales: total.sales + report.sales,
      revenue: total.revenue + report.revenue,
      grossProfit: total.grossProfit + report.grossProfit,
      invoices: total.invoices + report.invoices,
      unpaidInvoices: total.unpaidInvoices + report.unpaidInvoices,
      outstanding: total.outstanding + report.outstanding,
      adjustments: total.adjustments + report.adjustments,
    }),
    {
      products: 0,
      lowStock: 0,
      inventoryCost: 0,
      inventoryRetail: 0,
      sales: 0,
      revenue: 0,
      grossProfit: 0,
      invoices: 0,
      unpaidInvoices: 0,
      outstanding: 0,
      adjustments: 0,
    }
  )
}

export function ReportPrintButton({
  store,
  fromLabel,
  toLabel,
  reports,
  topMovingProducts,
  recentSales,
}: ReportPrintButtonProps) {
  const produceReportPdf = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Allow pop-ups to produce the report PDF.")
      return
    }

    const storeName = STORE_LABELS[store]
    const totals = sumReports(reports)
    const generatedAt = formatInKigali(new Date(), {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    const lowStockClass = totals.lowStock > 0 ? "metric danger" : "metric"
    const outstandingClass = totals.outstanding > 0 ? "metric warning" : "metric"

    const summaryRows = reports
      .map(
        (report) => `
          <tr>
            <td>${escapeHtml(STORE_LABELS[report.store])}</td>
            <td>${escapeHtml(formatCurrency(report.revenue))}</td>
            <td>${escapeHtml(formatCurrency(report.grossProfit))}</td>
            <td>${escapeHtml(formatNumber(report.sales))}</td>
            <td>${escapeHtml(formatNumber(report.products))}</td>
            <td>${escapeHtml(formatNumber(report.lowStock))}</td>
            <td>${escapeHtml(formatCurrency(report.outstanding))}</td>
          </tr>
        `
      )
      .join("")

    const topMovingRows = topMovingProducts
      .map(
        (product, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(product.sku)}</span>
            </td>
            <td>${escapeHtml(formatNumber(product.soldQuantity))} ${escapeHtml(product.unit ?? "pcs")}</td>
            <td>${escapeHtml(formatCurrency(product.revenue))}</td>
            <td>${escapeHtml(formatCurrency(product.grossProfit))}</td>
          </tr>
        `
      )
      .join("")

    const recentSaleRows = recentSales
      .map((sale) => {
        const items = sale.items
          .map((item) => item.name || item.sku)
          .filter(Boolean)
          .join(", ")

        return `
          <tr>
            <td>${escapeHtml(formatDateTime(sale.createdAt))}</td>
            <td>${escapeHtml(STORE_LABELS[sale.store])}</td>
            <td>${escapeHtml(items || "-")}</td>
            <td>${escapeHtml(formatCurrency(sale.totalAmount))}</td>
          </tr>
        `
      })
      .join("")

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(storeName)} Report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 28px;
              color: #17201b;
              font-family: Arial, sans-serif;
              background: #ffffff;
            }
            header {
              display: grid;
              grid-template-columns: 1fr auto;
              gap: 24px;
              align-items: start;
              border-bottom: 3px solid #1f8a5b;
              padding-bottom: 18px;
              margin-bottom: 18px;
            }
            h1 {
              margin: 0 0 6px;
              font-size: 30px;
              line-height: 1.1;
              letter-spacing: 0;
            }
            h2 {
              margin: 0 0 10px;
              font-size: 15px;
              color: #173c2b;
            }
            p {
              margin: 0 0 4px;
              color: #53645b;
              font-size: 12px;
            }
            .eyebrow {
              margin-bottom: 5px;
              color: #1f8a5b;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
            }
            .summary {
              min-width: 240px;
              border: 1px solid #c8ded2;
              padding: 12px;
              background: #fbfdfc;
              text-align: right;
              white-space: nowrap;
            }
            .summary strong {
              color: #173c2b;
            }
            .metrics {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 18px 0 22px;
            }
            .metric {
              min-height: 70px;
              border: 1px solid #d8e3dc;
              border-left: 4px solid #1f8a5b;
              padding: 10px;
              background: #fbfdfc;
            }
            .metric.warning {
              border-left-color: #c27803;
              background: #fffaf0;
            }
            .metric.danger {
              border-left-color: #b42318;
              background: #fff5f5;
            }
            .metric span {
              display: block;
              color: #53645b;
              font-size: 9px;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .metric strong {
              display: block;
              margin-top: 7px;
              font-size: 16px;
              line-height: 1.2;
            }
            .section-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              align-items: start;
            }
            section {
              margin-top: 18px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            section.full {
              grid-column: 1 / -1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th {
              background: #e9f6ef;
              color: #173c2b;
              text-align: left;
              border: 1px solid #c8ded2;
              padding: 8px 7px;
            }
            td {
              border: 1px solid #d8e3dc;
              padding: 7px;
              vertical-align: top;
            }
            td span {
              display: block;
              margin-top: 3px;
              color: #66746c;
              font-size: 11px;
            }
            tr:nth-child(even) td {
              background: #fbfdfc;
            }
            thead {
              display: table-header-group;
            }
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .footer {
              margin-top: 20px;
              border-top: 1px solid #d8e3dc;
              padding-top: 10px;
              color: #66746c;
              font-size: 10px;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <p class="eyebrow">Inventory Report</p>
              <h1>${escapeHtml(storeName)}</h1>
              <p>Period: ${escapeHtml(fromLabel)} to ${escapeHtml(toLabel)}</p>
            </div>
            <div class="summary">
              <p><strong>Multi-Store Inventory</strong></p>
              <p>Generated ${escapeHtml(generatedAt)}</p>
            </div>
          </header>

          <div class="metrics">
            <div class="metric"><span>Total Revenue</span><strong>${escapeHtml(formatCurrency(totals.revenue))}</strong></div>
            <div class="metric"><span>Gross Profit</span><strong>${escapeHtml(formatCurrency(totals.grossProfit))}</strong></div>
            <div class="metric"><span>Inventory Cost</span><strong>${escapeHtml(formatCurrency(totals.inventoryCost))}</strong></div>
            <div class="metric"><span>Inventory Retail</span><strong>${escapeHtml(formatCurrency(totals.inventoryRetail))}</strong></div>
            <div class="metric"><span>Sales Records</span><strong>${escapeHtml(formatNumber(totals.sales))}</strong></div>
            <div class="metric"><span>Products</span><strong>${escapeHtml(formatNumber(totals.products))}</strong></div>
            <div class="${lowStockClass}"><span>Low Stock</span><strong>${escapeHtml(formatNumber(totals.lowStock))}</strong></div>
            <div class="${outstandingClass}"><span>Outstanding</span><strong>${escapeHtml(formatCurrency(totals.outstanding))}</strong></div>
          </div>

          <div class="section-grid">
            <section class="full">
              <h2>Store Summary</h2>
              <table>
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Revenue</th>
                    <th>Gross Profit</th>
                    <th>Sales</th>
                    <th>Products</th>
                    <th>Low Stock</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  ${summaryRows || '<tr><td colspan="7">No summary data found.</td></tr>'}
                </tbody>
              </table>
            </section>

            <section>
              <h2>Top Moving Products</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Sold</th>
                    <th>Revenue</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  ${topMovingRows || '<tr><td colspan="5">No sales movement yet.</td></tr>'}
                </tbody>
              </table>
            </section>

            <section>
              <h2>Recent Sales</h2>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Store</th>
                    <th>Items</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentSaleRows || '<tr><td colspan="4">No sales recorded yet.</td></tr>'}
                </tbody>
              </table>
            </section>
          </div>

          <div class="footer">
            This report is generated from the current inventory database and reflects transactions recorded for the selected date range.
          </div>

          <script>
            window.addEventListener("load", () => {
              window.print();
            });
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <Button type="button" variant="outline" onClick={produceReportPdf}>
      <FileText className="size-4" />
      Report PDF
    </Button>
  )
}
