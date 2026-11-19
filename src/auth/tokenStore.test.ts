import { SESSION_STORAGE_KEY, tokenStore, type StoredSession } from './tokenStore'

const session: StoredSession = {
  accessToken: 'abc',
  expiresAt: '2030-01-01T00:00:00.000Z',
  refreshedAt: '2029-12-01T00:00:00.000Z',
}

describe('tokenStore', () => {
  it('RF01_savesReadsAndClearsTheSession', () => {
    expect(tokenStore.get()).toBeNull()

    tokenStore.save(session)
    expect(tokenStore.get()).toEqual(session)
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? '')).toEqual(session)

    tokenStore.clear()
    expect(tokenStore.get()).toBeNull()
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
  })

  it('ignoresAStoredValueThatIsNotASession', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, '{"nope":true}')
    expect(tokenStore.get()).toBeNull()

    window.localStorage.setItem(SESSION_STORAGE_KEY, 'not json')
    expect(tokenStore.get()).toBeNull()
  })

  it('keepsTheTokenInMemoryWhenWritingToStorageFails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    tokenStore.save(session)

    expect(tokenStore.get()).toEqual(session)
  })

  it('doesNotThrowWhenStorageIsUnavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    tokenStore.save(session)
    expect(tokenStore.get()).toEqual(session)

    expect(() => tokenStore.clear()).not.toThrow()
    expect(tokenStore.get()).toBeNull()
  })

  it('notifiesTheListenersWithTheReasonWhenCleared', () => {
    const listener = vi.fn()
    const unsubscribe = tokenStore.subscribe(listener)
    tokenStore.save(session)

    tokenStore.clear('expired')
    expect(listener).toHaveBeenCalledWith('expired')

    unsubscribe()
    tokenStore.clear('logout')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
