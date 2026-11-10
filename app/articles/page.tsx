import { redirect } from 'next/navigation'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
import EditorialEditor from '@/components/EditorialEditor'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage() {
  const access = await requireOwnerAdminApi()
  if (!access.ok) redirect(access.status === 401 ? '/login?callbackUrl=/articles' : '/')
  return <EditorialEditor />
}
