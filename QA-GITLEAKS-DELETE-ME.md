# DO NOT MERGE — gitleaks verification fixture

Branch: `qa/gitleaks-test`
Purpose: deliberately trip the Secret scan CI job, to verify QL-21 wiring works.

**This file and the branch MUST be deleted as soon as we have a red CI run captured.**

The values below are fake but structurally match gitleaks' default rules. None of these
are real credentials and they will not unlock anything.

## AWS

```
AWS_ACCESS_KEY_ID=AKIAEXAMPLEDONOTUSE0
AWS_SECRET_ACCESS_KEY=abcdefghijklmnopqrstuvwxyz0123456789ABCD
```

## GitHub

```
GITHUB_TOKEN=ghp_ExampleDoNotUseThisFakeTokenAAAA1234
```

## Slack

```
SLACK_BOT_TOKEN=xoxb-1111111111-1111111111111-aaaaaaaaaaaaaaaaaaaaaaaa
```

## Stripe

```
STRIPE_SECRET_KEY=sk_live_abcdefghijklmnop12345678
```
