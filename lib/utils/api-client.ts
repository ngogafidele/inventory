export async function apiClient<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return (await response.json()) as T
}
