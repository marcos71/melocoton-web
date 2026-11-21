import { canUsePath } from './access'

describe('canUsePath', () => {
  it('RF02_theLeadTeacherReachesTheStudentRoutesWithAnId', () => {
    expect(canUsePath('LEAD_TEACHER', '/students')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/new')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/12')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/12/edit')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/12/fixed-slot')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/12/drop-in/new')).toBe(true)
  })

  it('RF02_ignoresTheQueryTheFragmentAndTheTrailingSlashOfAParameterizedPath', () => {
    expect(canUsePath('LEAD_TEACHER', '/students/12?x=1')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/12/edit#top')).toBe(true)
    expect(canUsePath('LEAD_TEACHER', '/students/12/')).toBe(true)
  })

  it('RF02_aParameterNeverMatchesMoreOrFewerSegmentsThanThePattern', () => {
    expect(canUsePath('LEAD_TEACHER', '/students/12/other')).toBe(false)
    expect(canUsePath('LEAD_TEACHER', '/students/12/edit/more')).toBe(false)
    expect(canUsePath('LEAD_TEACHER', '/students/12/drop-in')).toBe(false)
    expect(canUsePath('LEAD_TEACHER', '/students//edit')).toBe(false)
    expect(canUsePath('LEAD_TEACHER', '/other/12')).toBe(false)
  })

  it.each(['STUDENT', 'ASSISTANT_TEACHER'] as const)(
    'RF02_%sNeverReachesTheStudentManagementRoutes',
    (role) => {
      expect(canUsePath(role, '/students')).toBe(false)
      expect(canUsePath(role, '/students/new')).toBe(false)
      expect(canUsePath(role, '/students/12')).toBe(false)
      expect(canUsePath(role, '/students/12/fixed-slot')).toBe(false)
    },
  )

  it('RF02_theExactPathsKeepWorking', () => {
    expect(canUsePath('LEAD_TEACHER', '/admin/assistant-teachers/new')).toBe(true)
    expect(canUsePath('ASSISTANT_TEACHER', '/today')).toBe(true)
    expect(canUsePath('ASSISTANT_TEACHER', '/admin')).toBe(false)
  })
})
