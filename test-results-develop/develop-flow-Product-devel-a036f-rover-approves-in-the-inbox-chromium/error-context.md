# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: develop-flow.spec.ts >> Product development flow (UI) >> approver requests material changes, pattern master resubmits, approver approves in the inbox
- Location: e2e\develop-flow.spec.ts:316:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^Notifications/ })

```

```
Fixture "trace recording" timeout of 120000ms exceeded during teardown.
```