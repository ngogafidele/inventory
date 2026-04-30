"use client"

import { useEffect, useState } from "react"

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(url)
      .then((response) => response.json())
      .then((payload) => {
        if (active) {
          setData(payload as T)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [url])

  return { data, loading, error }
}
