# distributed-scheduler-front

The web dashboard for the distributed job scheduler, a service for scheduling HTTP calls to your own endpoints (once, at a given time, or on a cron expression) with priorities, automatic retries and a dead letter queue.

From this dashboard you will be able to create and manage tasks, follow their runs, inspect why a job failed and retry the ones that ended up in the dead letter queue.

The project is at the planning stage: there is no application code yet. The screens below are mockups of how it is meant to look, not screenshots of a running app. The full spec is in [plan/SPEC.md](plan/SPEC.md).

## How it will look

### Tasks

Every scheduled task, with its schedule, priority, status and next run.

![Tasks](plan/docs/mockups/01-tasks.png)

### Task detail

A task's configuration, performance and run history.

![Task detail](plan/docs/mockups/02-task-detail.png)

### Job detail

One execution in depth: each attempt, the request sent and the response received.

![Job detail](plan/docs/mockups/03-job-detail.png)

### Dead letter

Jobs that exhausted every retry, ready to be reviewed and retried.

![Dead letter](plan/docs/mockups/04-dead-letter.png)

### Admin metrics

Internal platform view: throughput, scheduling lag, pending jobs, tenants and shards.

![Admin metrics](plan/docs/mockups/05-admin-metrics.png)
