# CloudFormation — illustrative only

> **Status: Production design. These templates have NOT been deployed.**
> They show how the TripSense prototype would be hosted on AWS. They are
> written to be realistic and are syntax-checked with `cfn-lint`, but they
> have not been deployed or load-tested.

| Template | What it shows |
| --- | --- |
| `network.yaml` | VPC across two Availability Zones, public/private subnets, NAT per AZ, VPC flow logs |
| `app.yaml` | ECS Fargate BFF service with autoscaling, internal ALB, API Gateway HTTP API (VPC Link, throttling, access logs), S3 + CloudFront frontend (OAC, security headers), Secrets Manager for the AI key, IAM least privilege, CloudWatch logs, alarms and a metric filter for agent tool errors |
| `database.yaml` | Multi-AZ RDS PostgreSQL, encrypted, private, Secrets Manager-managed password, backups, deletion protection |

Deployment order (if it were deployed): `network` → `app` → `database`
(passing `AppSecurityGroupId` from `app` to `database`).

Validate locally:

```bash
pip install cfn-lint
cfn-lint infra/cloudformation/*.yaml
```
