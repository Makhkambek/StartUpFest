import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const tvMode = typeof redirect === 'string' && redirect.includes('/field/')
  return <LoginForm redirectTo={redirect} tvMode={tvMode} />
}
