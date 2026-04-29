# Phase 8 Discussion Log

**Phase:** 8 - Tunnel Infrastructure
**Discussed:** 2026-04-29

## Areas Discussed

### Domain Scope
**Question:** Should www.krepza.lt redirect to krepza.lt, or just serve on krepza.lt only?
**Options:** krepza.lt only | Both, redirect www
**Selected:** Both, redirect www
**Rationale:** Standard practice for apex domain + www coverage

### Migration Strategy
**Question:** Incremental (keep port 3131 during testing) or big bang (replace port with tunnel immediately)?
**Options:** Incremental (recommended) | Big bang
**Selected:** Incremental (recommended)
**Rationale:** Allows testing tunnel before removing port exposure, prevents unreachable-web scenario during DNS propagation

### OAuth Console Access
**Question:** Do you have access to update Google Cloud Console and Facebook Developers dashboards?
**Options:** I have access | Need guidance | Partial access
**Selected:** I have access
**Rationale:** User will update OAuth redirect URIs in both consoles themselves after tunnel is operational
