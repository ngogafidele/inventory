// Provides simple line-item total calculations for shared form contexts.
export type LineItem = {
  quantity: number
  price: number
}

export function calculateTotal(items: LineItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0)
}
