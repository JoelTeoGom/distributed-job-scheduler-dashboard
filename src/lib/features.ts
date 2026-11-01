export const features = {
  metrics: false, // stat cards, charts, admin page
  runNow: false, // "Run now" button
  attemptsTimeline: false, // per-attempt rows and response headers
  lastRunColumn: false, // until GET /tasks returns it (or accept the N+1)
  serverFilters: false, // search and filters on lists
  counts: false, // stat counts + sidebar badge
  globalRuns: false,
  alerts: false,
  callbacks: false,
  apiKeys: false,
  auditLog: false,
  usage: false,
  settings: false,
  auth: false, // login, workspace switcher, user menu
  jobDetailsExtended: false, // first start, total time, last worker, config version, stored in
} as const
