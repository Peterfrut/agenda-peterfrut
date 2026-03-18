export type UserRow = {
  id: string
  name: string | null
  email: string
  emailVerifiedAt: string | null
  role: "user" | "admin" | null
}