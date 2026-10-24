export type ProductRequestNotification = {
  id: string
  name: string
  kind: "create" | "edit"
  submittedByName: string
  createdAtLabel: string
}
