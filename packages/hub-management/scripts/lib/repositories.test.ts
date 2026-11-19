import { describe, expect, it } from 'vitest'

// Plain ESM shared with hub-import.mjs; import it directly so the test
// exercises the exact code the seed runs.
import { repositoryFolders } from './repositories.mjs'

const repos = [
  { id: 'r-content', label: 'Content' },
  { id: 'r-slots', label: 'Slots' },
  { id: 'r-site', label: 'Site Components' },
]

describe('repositoryFolders', () => {
  it('maps each configured repository to its label', () => {
    expect(
      repositoryFolders(
        { AMPLIENCE_REPO_CONTENT: 'r-content', AMPLIENCE_REPO_SLOTS: 'r-slots' },
        repos,
      ),
    ).toEqual({ AMPLIENCE_REPO_CONTENT: 'Content', AMPLIENCE_REPO_SLOTS: 'Slots' })
  })

  it('names the variable when an id is not on the hub', () => {
    expect(() => repositoryFolders({ AMPLIENCE_REPO_SLOTS: 'nope' }, repos)).toThrow(
      /AMPLIENCE_REPO_SLOTS is "nope"/,
    )
  })

  it('refuses a label two repositories share — dc-cli could not tell them apart', () => {
    const twins = [...repos, { id: 'r-other', label: 'Content' }]
    expect(() => repositoryFolders({ AMPLIENCE_REPO_CONTENT: 'r-content' }, twins)).toThrow(
      /2 repositories on this hub are labelled "Content"/,
    )
  })

  it('ignores a shared label on a repository that is not configured', () => {
    const twins = [...repos, { id: 'r-x', label: 'Archive' }, { id: 'r-y', label: 'Archive' }]
    expect(repositoryFolders({ AMPLIENCE_REPO_CONTENT: 'r-content' }, twins)).toEqual({
      AMPLIENCE_REPO_CONTENT: 'Content',
    })
  })

  it.each(['', '   ', '.', '..', 'Content/Pages', 'Content\\Pages'])(
    'refuses the label %j, which cannot be a folder name',
    (label) => {
      expect(() =>
        repositoryFolders({ AMPLIENCE_REPO_CONTENT: 'r' }, [{ id: 'r', label }]),
      ).toThrow(/can't be used as a folder name/)
    },
  )
})
