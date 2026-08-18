# Project TODO

## Bug fixes — reliable agent execution and on-time delivery (Aug 2026)

- [x] Deliver an in-app notification to the owner after every completed research run (notifyOwner was previously only wired to an admin debug tool, so completed runs were silent).
- [x] Deliver an in-app failure alert when a pipeline run fails, so silent failures never go unnoticed.
- [x] Include email-delivery failure details in the completion notification instead of hiding them.
- [x] Add retry logic with exponential backoff to Groq LLM calls (3 attempts, 1.5s/3s/6s) so transient 429/5xx responses don't abort whole research runs.
- [x] Add retry logic with graceful fallback to Resend email delivery (3 attempts) with a clear failure reason instead of a raw fetch exception.
- [x] Fix task update so changing the schedule, status, or name re-syncs the underlying heartbeat cron job (edits previously mutated only the DB row while the scheduled job kept its old cadence).
- [x] Improve email HTML rendering (headings, bold, links) so digest and alert emails arrive formatted and readable.
- [x] Fix the Groq unit tests that broke when retry logic required GROQ_API_KEY to be set in tests.

- [x] Define the schema for research tasks, sources, execution profiles, cron schedules, collections, monitored entities, pipeline runs, findings, reports, conversations, delivery events, and audit logs.
- [x] Create secure configuration for the user-provided Groq API key and validate its availability without exposing the value.
- [x] Revalidate the refined Intelis visual system across all main product views after final changes.
- [x] Implement CRUD operations for natural-language research tasks with source, keyword, topic, and delivery configuration.
- [x] Implement selectable per-task execution profiles and six-field UTC cron management with persistent scheduled job lifecycle controls.
- [x] Implement collections and continuous entity following for companies, people, and topics.
- [x] Complete the multi-agent pipeline with materialized crawling and independent-source corroboration.
- [x] Add Groq-powered trend synthesis and anomaly analysis across historical entity changes.
- [x] Implement finding quality metrics, relevance classification, entity extraction, source credibility, and research reports.
- [x] Persist concrete before-and-after monitored-entity changes across research runs and surface resulting anomalies.
- [x] Extend semantic Ask Mode retrieval to include accumulated reports as well as findings.
- [x] Complete summary, digest, and alert report generation with automated in-app and email delivery behavior.
- [x] Implement the dashboard overview with active tasks, recent findings, trend charts, quality metrics, and pipeline run history.
- [x] Add focused tests covering schedule validation, pipeline analysis, semantic Ask Mode, and delivery behavior.
- [x] Validate the refined interface across desktop and mobile breakpoints and push the final GitHub update.
- [x] Fix research-task cron validation so standard hourly, daily, weekly, and custom schedules can be created without raw validation errors.
- [x] Replace raw cron entry in the research task form with a time-based schedule picker for hourly, daily, weekly, and custom intervals.
- [x] Add a live next-run countdown or timing indicator for all scheduled tasks on the dashboard.
- [x] Verify live Groq pipeline stage persistence and visible task progress through queued, running, and completed states.
- [x] Add router-level test coverage for pause, resume, and manual-run task-control behavior.
- [x] Visually validate dashboard and research-task controls in idle, running, paused, and resumed states.
- [x] Add PDF and CSV exports for both Groq research findings and generated reports. (Reports page ships per-report PDF export and Export all CSV wired to researchExport; findings export available from the Ask Mode findings view.)
- [x] Add dashboard search and filters for scheduled research tasks.
- [x] Verify persisted dark-mode preference and add dark-mode-specific coverage.
- [x] Run an explicit dark-mode visual QA pass for export and filter screens. (Card surfaces, form inputs, selects, buttons, and profile toggles across Reports, ResearchTasks, Collections, AskMode, and TaskScheduleBoard now render correctly in dark mode.)
- [x] Inspect GitHub commit attribution and contributor history for the Intelis Agent repository. (All commits are authored by the user's own identity; no foreign contributors.)
- [x] Correct any commits not attributed to the user's authorized GitHub identity. (Nothing to correct; attribution was already clean.)
- [x] Verify the resulting GitHub contributor history and report the outcome. (History verified clean in the July review.)
