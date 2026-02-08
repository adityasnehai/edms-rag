# POST-008: Postmortem for INC-008

## incident_summary
INC-008 caused degraded performance and delayed workflows for multiple tenants.

## root_cause
A design assumption made in ADR-008 did not hold under real production load,
leading to the failure described in INC-008.

## resolution
Rolled back risky configuration, applied hotfixes, and added safeguards.

## lessons_learned
- Load assumptions must be validated with stress tests
- Rollouts require stronger guardrails

## follow_up_actions
JIRA-108
