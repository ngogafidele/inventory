"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ReportPrintButton() {
  const [downloading, setDownloading] = useState(false)

  const produceReportPdf = async () => {
    setDownloading(true)

    try {
      const query = window.location.search
      const response = await fetch(`/api/reports/pdf${query}`)

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        alert(body?.error ?? "Failed to download report PDF.")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const disposition = response.headers.get("content-disposition")
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] ?? "report.pdf"

      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert("Failed to download report PDF.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={produceReportPdf}
      disabled={downloading}
    >
      <FileText className="size-4" />
      {downloading ? "Preparing..." : "Report PDF"}
    </Button>
  )
}
