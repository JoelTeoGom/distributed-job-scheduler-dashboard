# Frontend

- Follow SPEC.md. The mockups in docs/mockups/ are the source of truth for layout and style.
- Never invent endpoints or fields. Derive DTOs from the Go code of the task service and job service.
- If the backend does not support something, put it behind lib/features.ts (SPEC.md section 6).
- MSW mocks are enabled with NEXT_PUBLIC_API_MOCKS=true so every screen works without the services.
