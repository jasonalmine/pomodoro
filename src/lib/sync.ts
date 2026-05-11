// PocketBase sync adapter — stubbed for now.
// When ready, wire a PocketBase JS SDK client here that pushes/pulls
// `projects`, `pomodoros`, and `settings` records keyed by user_id.
//
// Suggested PocketBase collections:
//   projects:  id (text), user (relation), name, color, description, archived, createdAt
//   pomodoros: id (text), user, projectId, task, startedAt, endedAt,
//              plannedSeconds, actualSeconds, completed, note, ritualUsed
//   settings:  user (unique relation), payload (json)
//
// Use updated/last_synced timestamps for incremental sync.

export type SyncAdapter = {
  enabled: boolean
  push: () => Promise<void>
  pull: () => Promise<void>
}

export function makeSyncAdapter(pocketBaseUrl?: string): SyncAdapter {
  if (!pocketBaseUrl) {
    return {
      enabled: false,
      push: async () => {/* noop until configured */},
      pull: async () => {/* noop */},
    }
  }
  return {
    enabled: true,
    push: async () => {/* TODO: implement using pocketbase JS SDK */},
    pull: async () => {/* TODO */},
  }
}
