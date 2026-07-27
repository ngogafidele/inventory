// Fetches a PDF endpoint and saves the response under the server's filename.
// Returns an error message, or null when the download started.
export async function downloadPdf(
  url: string,
  fallbackName: string
): Promise<string | null> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return body?.error ?? "Failed to download the PDF."
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const disposition = response.headers.get("content-disposition")

    link.href = objectUrl
    link.download = disposition?.match(/filename="(.+)"/)?.[1] ?? fallbackName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)

    return null
  } catch {
    return "Failed to download the PDF."
  }
}
