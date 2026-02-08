# POST-005: Postmortem for INC-005

## incident_summary
INC-005 caused degraded performance and delayed workflows for multiple tenants.

## root_cause
A design assumption made in ADR-005 did not hold under real production load,
leading to the failure described in INC-005.

## resolution
Rolled back risky configuration, applied hotfixes, and added safeguards.

## lessons_learned
- Load assumptions must be validated with stress tests
- Rollouts require stronger guardrails

## follow_up_actions
JIRA-105
