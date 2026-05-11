# POSTMORTEM-008: Upload Queue Delay

Severity: Medium
Service: EDMS Ingestion
Last Updated: 2026-05-08 13:00 UTC

## Incident Summary
An admin uploaded records and saw the UI remain on queued even after backend indexing completed.

## Root Cause
The frontend did not continue polling job status in all development render paths.

## Resolution
Polling state was corrected and the UI now updates from queued to running or completed.

## Lessons Learned
Job state should be read from backend ingestion records instead of only relying on initial upload response text.
