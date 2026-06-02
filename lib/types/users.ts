export type UserRow = {
  id: string
  name: string | null
  email: string
  active: boolean
  emailVerifiedAt: string | null
  role: "user" | "admin" | null
}
