# POST-009: Postmortem for INC-009

## incident_summary
INC-009 caused degraded performance and delayed workflows for multiple tenants.

## root_cause
A design assumption made in ADR-009 did not hold under real production load,
leading to the failure described in INC-009.

## resolution
Rolled back risky configuration, applied hotfixes, and added safeguards.

## lessons_learned
- Load assumptions must be validated with stress tests
- Rollouts require stronger guardrails

## follow_up_actions
JIRA-109
