export interface JudgeUserConfig {
  username: string
  password: string
  role: 'admin' | 'judge'
  categories: string[]
}

const USER_SPECS: Array<Omit<JudgeUserConfig, 'password'> & { envVar: string }> = [
  { envVar: 'SFRC_ADMIN_PASSWORD',    username: 'admin',    role: 'admin', categories: ['a','b','c','d'] },
  { envVar: 'SFRC_JUDGE_A1_PASSWORD', username: 'judge_a1', role: 'judge', categories: ['a'] },
  { envVar: 'SFRC_JUDGE_A2_PASSWORD', username: 'judge_a2', role: 'judge', categories: ['a'] },
  { envVar: 'SFRC_JUDGE_B1_PASSWORD', username: 'judge_b1', role: 'judge', categories: ['b'] },
  { envVar: 'SFRC_JUDGE_B2_PASSWORD', username: 'judge_b2', role: 'judge', categories: ['b'] },
  { envVar: 'SFRC_JUDGE_C1_PASSWORD', username: 'judge_c1', role: 'judge', categories: ['c'] },
  { envVar: 'SFRC_JUDGE_C2_PASSWORD', username: 'judge_c2', role: 'judge', categories: ['c'] },
  { envVar: 'SFRC_JUDGE_D1_PASSWORD', username: 'judge_d1', role: 'judge', categories: ['d'] },
  { envVar: 'SFRC_JUDGE_D2_PASSWORD', username: 'judge_d2', role: 'judge', categories: ['d'] },
]

export function loadJudgeUsers(): JudgeUserConfig[] {
  const missing: string[] = []
  const weak: string[] = []
  const users: JudgeUserConfig[] = []

  for (const spec of USER_SPECS) {
    const pwd = process.env[spec.envVar]
    if (!pwd) {
      missing.push(spec.envVar)
      continue
    }
    if (pwd.length < 12) {
      weak.push(`${spec.envVar} (length=${pwd.length}, min 12)`)
      continue
    }
    users.push({
      username: spec.username,
      password: pwd,
      role: spec.role,
      categories: spec.categories,
    })
  }

  if (missing.length || weak.length) {
    const lines = ['Cannot load judge users:']
    if (missing.length) lines.push(`  Missing env vars: ${missing.join(', ')}`)
    if (weak.length) lines.push(`  Weak passwords: ${weak.join(', ')}`)
    lines.push('  Set these in .env.local (gitignored) and re-run with `--env-file=.env.local`.')
    throw new Error(lines.join('\n'))
  }

  return users
}
