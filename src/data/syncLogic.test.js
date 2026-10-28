import {
  SYNC_META_KEY,
  readSyncMeta,
  writeSyncMeta,
  clearLocalCache,
  readLocalSnapshot,
  countData,
  hasLocalData,
  chooseLoadPath,
  createPushQueue,
  describeLastSynced,
  unsavedWorkWarning
} from './syncLogic';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  localStorage.clear();
});

describe('sync meta and the local cache', () => {
  test('reads defaults when nothing is stored', () => {
    expect(readSyncMeta()).toEqual({ lastSeen: null, dirty: false, lastSyncedAt: null });
  });

  test('writeSyncMeta merges a patch into what is stored', () => {
    writeSyncMeta({ lastSeen: 't1' });
    writeSyncMeta({ dirty: true });
    expect(readSyncMeta()).toEqual({ lastSeen: 't1', dirty: true, lastSyncedAt: null });
    expect(JSON.parse(localStorage.getItem(SYNC_META_KEY)).lastSeen).toBe('t1');
  });

  test('clearLocalCache removes the data, profile, sync meta, and the note draft', () => {
    localStorage.setItem('ptAppData', '{}');
    localStorage.setItem('pt-app-profile', '{}');
    localStorage.setItem(SYNC_META_KEY, '{}');
    localStorage.setItem('ptAppSessionDraft', '{}');
    clearLocalCache();
    expect(localStorage.getItem('ptAppData')).toBeNull();
    expect(localStorage.getItem('pt-app-profile')).toBeNull();
    expect(localStorage.getItem(SYNC_META_KEY)).toBeNull();
    expect(localStorage.getItem('ptAppSessionDraft')).toBeNull();
  });

  test('readLocalSnapshot parses both keys', () => {
    const data = { patients: [], sessions: [], schools: [] };
    localStorage.setItem('ptAppData', JSON.stringify(data));
    localStorage.setItem('pt-app-profile', JSON.stringify({ firstName: 'Jordan' }));
    expect(readLocalSnapshot()).toMatchObject({ data, profile: { firstName: 'Jordan' }, dataUnreadable: false, profileUnreadable: false });
  });

  test('readLocalSnapshot flags data that does not parse and keeps the raw text', () => {
    localStorage.setItem('ptAppData', '{not json');
    expect(readLocalSnapshot()).toMatchObject({ data: null, dataRaw: '{not json', dataUnreadable: true });
  });

  test('readLocalSnapshot flags data without patient and note arrays', () => {
    localStorage.setItem('ptAppData', JSON.stringify({ patients: 'x' }));
    expect(readLocalSnapshot()).toMatchObject({ data: null, dataUnreadable: true });
  });

  test('readLocalSnapshot flags a profile that does not parse', () => {
    localStorage.setItem('pt-app-profile', '{not json');
    expect(readLocalSnapshot()).toMatchObject({ profile: null, profileUnreadable: true });
  });

  test('readLocalSnapshot does not flag missing keys', () => {
    expect(readLocalSnapshot()).toMatchObject({ data: null, profile: null, dataUnreadable: false, profileUnreadable: false });
  });
});

describe('counting local data', () => {
  const data = {
    patients: [{ id: 'p1' }, { id: 'p2', deleted_at: '2026-10-01' }],
    sessions: [{ id: 's1' }, { id: 's2' }, { id: 's3', deleted_at: '2026-10-01' }],
    schools: [{ id: 'sc1' }]
  };

  test('countData skips soft-deleted items', () => {
    expect(countData(data)).toEqual({ patients: 1, sessions: 2, schools: 1 });
  });

  test('countData treats missing data as empty', () => {
    expect(countData(null)).toEqual({ patients: 0, sessions: 0, schools: 0 });
  });

  test('hasLocalData is false for empty arrays and a blank profile', () => {
    const snapshot = {
      data: { patients: [], sessions: [], schools: [] },
      profile: { firstName: '', lastName: '', credentials: [], license: '' }
    };
    expect(hasLocalData(snapshot)).toBe(false);
  });

  test('hasLocalData counts a soft-deleted patient', () => {
    const snapshot = { data: { patients: [{ id: 'p1', deleted_at: '2026-10-01' }], sessions: [], schools: [] }, profile: null };
    expect(hasLocalData(snapshot)).toBe(true);
  });

  test('hasLocalData counts a profile with only a license', () => {
    expect(hasLocalData({ data: null, profile: { license: 'PT12345' } })).toBe(true);
  });
});

describe('chooseLoadPath', () => {
  const row = { updated_at: 't2', data: {}, profile: {} };

  test.each([
    ['no row, local data', { row: null, localHasData: true, dirty: false, lastSeen: null }, 'migrate'],
    ['no row, no local data', { row: null, localHasData: false, dirty: false, lastSeen: null }, 'create-empty'],
    ['row, never synced here, local data', { row, localHasData: true, dirty: false, lastSeen: null }, 'first-device'],
    ['row, never synced here, no local data', { row, localHasData: false, dirty: false, lastSeen: null }, 'apply-row'],
    ['row unchanged since an unpushed save', { row, localHasData: true, dirty: true, lastSeen: 't2' }, 'push-cache'],
    ['row changed since an unpushed save', { row, localHasData: true, dirty: true, lastSeen: 't1' }, 'conflict'],
    ['row and a clean cache', { row, localHasData: true, dirty: false, lastSeen: 't1' }, 'apply-row'],
    ['unreadable dirty cache with a row', { row, localHasData: false, dirty: true, lastSeen: 't2', localUnreadable: true }, 'unreadable-cache'],
    ['unreadable clean cache with no row', { row: null, localHasData: false, dirty: false, lastSeen: null, localUnreadable: true }, 'unreadable-cache']
  ])('%s', (_, input, expected) => {
    expect(chooseLoadPath(input)).toBe(expected);
  });
});

describe('createPushQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('coalesces several changes within 500 ms into one push', async () => {
    const push = jest.fn().mockResolvedValue();
    const onStatus = jest.fn();
    const queue = createPushQueue({ push, onStatus });
    queue.schedule();
    jest.advanceTimersByTime(200);
    queue.schedule();
    jest.advanceTimersByTime(200);
    queue.schedule();
    jest.advanceTimersByTime(499);
    expect(push).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenLastCalledWith('saved');
  });

  test('retries after 1, 2, and 4 seconds, then reports failed', async () => {
    const push = jest.fn().mockRejectedValue(new Error('offline'));
    const onStatus = jest.fn();
    const queue = createPushQueue({ push, onStatus });
    queue.schedule();
    jest.advanceTimersByTime(500);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(999);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(push).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(2000);
    await flush();
    expect(push).toHaveBeenCalledTimes(3);
    expect(onStatus).not.toHaveBeenCalledWith('failed');
    jest.advanceTimersByTime(4000);
    await flush();
    expect(push).toHaveBeenCalledTimes(4);
    expect(onStatus).toHaveBeenLastCalledWith('failed');
    jest.advanceTimersByTime(60000);
    await flush();
    expect(push).toHaveBeenCalledTimes(4);
  });

  test('flushNow after a failure pushes at once and reports saved', async () => {
    const push = jest.fn().mockRejectedValue(new Error('offline'));
    const onStatus = jest.fn();
    const queue = createPushQueue({ push, onStatus, retryDelaysMs: [] });
    queue.schedule();
    jest.advanceTimersByTime(500);
    await flush();
    expect(onStatus).toHaveBeenLastCalledWith('failed');
    push.mockResolvedValue();
    queue.flushNow();
    await flush();
    expect(push).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenLastCalledWith('saved');
  });

  test('a change during an in-flight push makes exactly one more push after it', async () => {
    let finishFirst;
    const push = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue();
    const queue = createPushQueue({ push, onStatus: () => {} });
    queue.schedule();
    jest.advanceTimersByTime(500);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);

    queue.schedule();
    jest.advanceTimersByTime(500);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);

    finishFirst();
    await flush();
    expect(push).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(10000);
    await flush();
    expect(push).toHaveBeenCalledTimes(2);
  });

  test('a change while waiting to retry does not stall the queue', async () => {
    const push = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue();
    const onStatus = jest.fn();
    const queue = createPushQueue({ push, onStatus });
    queue.schedule();
    jest.advanceTimersByTime(500);
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
    queue.schedule();
    jest.advanceTimersByTime(5000);
    await flush();
    jest.advanceTimersByTime(5000);
    await flush();
    expect(push.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onStatus).toHaveBeenLastCalledWith('saved');
  });

  test('cancel stops a scheduled push', async () => {
    const push = jest.fn().mockResolvedValue();
    const queue = createPushQueue({ push, onStatus: () => {} });
    queue.schedule();
    queue.cancel();
    jest.advanceTimersByTime(1000);
    await flush();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('describeLastSynced', () => {
  const now = new Date(2026, 9, 28, 12, 0, 0);
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();

  test.each([
    [null, 'Not synced yet'],
    [ago(20 * 1000), 'Last synced just now'],
    [ago(60 * 1000), 'Last synced 1 minute ago'],
    [ago(2 * 60 * 1000), 'Last synced 2 minutes ago'],
    [ago(3 * 60 * 60 * 1000), 'Last synced 3 hours ago'],
    [ago(2 * 24 * 60 * 60 * 1000), 'Last synced 2 days ago']
  ])('%s', (lastSyncedAt, expected) => {
    expect(describeLastSynced(lastSyncedAt, now)).toBe(expected);
  });
});

describe('unsavedWorkWarning', () => {
  test('is null when everything reached the cloud and no note is in progress', () => {
    writeSyncMeta({ dirty: false });
    expect(unsavedWorkWarning()).toBeNull();
  });

  test('names changes that have not reached the cloud', () => {
    writeSyncMeta({ dirty: true });
    expect(unsavedWorkWarning()).toMatch(/haven't reached the cloud/);
  });

  test('names a note draft in progress', () => {
    localStorage.setItem('ptAppSessionDraft', JSON.stringify({ patientId: 'p1' }));
    expect(unsavedWorkWarning()).toMatch(/note you started/);
  });
});
