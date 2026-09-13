import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SHA_RE = /^[0-9a-f]{40}$/

/**
 * Resolves the current HEAD commit of a git working tree by reading its
 * `.git` metadata directly (no `git` subprocess, no network). This keeps
 * pinned-commit verification hermetic and avoids ever executing hooks from
 * an upstream checkout we only trust as inert data.
 */
export function resolveGitHead(sourceDir) {
  const gitDir = join(sourceDir, '.git')
  if (!existsSync(gitDir)) {
    throw new Error(`"${sourceDir}" has no .git directory; it is not a git checkout of the pinned upstream source.`)
  }

  const headPath = join(gitDir, 'HEAD')
  if (!existsSync(headPath)) {
    throw new Error(`"${headPath}" is missing; cannot determine the checked-out commit.`)
  }
  const head = readFileSync(headPath, 'utf8').trim()

  if (SHA_RE.test(head)) return head

  const refMatch = /^ref:\s*(\S+)$/.exec(head)
  if (!refMatch) {
    throw new Error(`Unrecognized .git/HEAD contents: "${head}"`)
  }
  const ref = refMatch[1]

  const loosePath = join(gitDir, ref)
  if (existsSync(loosePath)) {
    const sha = readFileSync(loosePath, 'utf8').trim()
    if (SHA_RE.test(sha)) return sha
    throw new Error(`"${loosePath}" does not contain a valid commit sha: "${sha}"`)
  }

  const packedRefsPath = join(gitDir, 'packed-refs')
  if (existsSync(packedRefsPath)) {
    const packed = readFileSync(packedRefsPath, 'utf8')
    for (const line of packed.split('\n')) {
      if (line.startsWith('#')) continue
      const [sha, name] = line.trim().split(/\s+/)
      if (name === ref && sha && SHA_RE.test(sha)) return sha
    }
  }

  throw new Error(`Could not resolve ref "${ref}" to a commit sha in "${gitDir}".`)
}
