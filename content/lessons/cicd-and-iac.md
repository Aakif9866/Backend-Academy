---
title: CI/CD, Infrastructure as Code and Deployment Strategies
summary: Continuous integration with GitHub Actions, building and promoting immutable artefacts, Terraform fundamentals, cloud building blocks across AWS, GCP and Azure, secrets management, and rolling, blue-green and canary deployments with feature flags.
difficulty: advanced
minutes: 60
prerequisites: [docker-and-compose, git-workflow]
objectives:
  - Build a CI pipeline that tests, scans and builds an immutable image on every change
  - Promote the same artefact through environments with a CD pipeline
  - Write Terraform for cloud resources and manage state safely
  - Map core cloud building blocks across AWS, GCP and Azure
  - Manage secrets without putting them in code or images
  - Choose between rolling, blue-green and canary deployments and use feature flags to decouple deploy from release
videos:
  - id: R8_veQiYBjI
    title: GitHub Actions Tutorial - Basic Concepts and CI/CD Pipeline with Docker
    channel: TechWorld with Nana
    why: A hands-on walkthrough of workflows, jobs and building Docker images in Actions.
  - id: tomUWcQ0P3k
    title: Terraform in 100 Seconds
    channel: Fireship
    why: A quick picture of declarative infrastructure, plan and apply.
  - id: SLB_c_ayRMo
    title: Terraform Course - Automate your AWS cloud infrastructure
    channel: freeCodeCamp.org
    why: A full course building real AWS infrastructure with Terraform, if you want depth.
resources:
  - url: https://docs.github.com/en/actions
    title: GitHub Actions documentation
    why: Workflow syntax, caching, environments, OIDC to cloud providers, and reusable workflows.
  - url: https://developer.hashicorp.com/terraform/tutorials
    title: Terraform tutorials (HashiCorp)
    why: Official step-by-step tutorials, including state, modules and remote backends.
  - url: https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect
    title: "GitHub: Security hardening with OpenID Connect"
    why: How CI can access AWS, GCP or Azure with short-lived credentials instead of stored keys.
  - url: https://martinfowler.com/articles/feature-toggles.html
    title: "Pete Hodgson: Feature Toggles (Feature Flags)"
    why: The definitive article on types of flags and managing their lifecycle.
  - url: https://dora.dev/guides/dora-metrics-four-keys/
    title: DORA's four key metrics
    why: Deployment frequency, lead time, change failure rate and time to restore, the research-backed delivery metrics.
quiz:
  - type: mcq
    q: Why build the container image once and promote the same image (by digest) from staging to production?
    options: ["It's faster to type", "So production runs exactly the artefact that was tested; rebuilding per environment can pick up different dependencies or base images", "Registries charge per build", "Kubernetes requires it"]
    answer: 1
    explain: "Build once, deploy many. Environment differences belong in configuration, not in separately built artefacts."
  - type: scenario
    q: A new version has a subtle bug affecting 2% of requests. Which strategy limits the blast radius best?
    options: ["Recreate (stop all, start all)", "Canary: route a small percentage of traffic to the new version, compare error rates and latency with the baseline, then expand or roll back", "Deploy on Friday evening", "Blue-green with an instant 100% switch"]
    answer: 1
    explain: "Canaries expose a small slice of users and use metrics to decide automatically. Blue-green gives instant rollback but sends everyone to the new version at once."
  - type: tf
    q: Terraform state files can contain secrets and must be stored securely (encrypted remote backend with access controls and locking).
    answer: 0
    explain: "True. State records resource attributes, which can include passwords and keys. Use a remote backend (S3 with locking, GCS, Terraform Cloud) with encryption and restricted access, never commit it to Git."
  - type: mcq
    q: What is the safest way for a CI pipeline to deploy to AWS?
    options: ["Store a long-lived access key in repository secrets", "Use OIDC federation so the workflow assumes a narrowly scoped role with short-lived credentials", "Commit credentials to a private repo", "Use the root account"]
    answer: 1
    explain: "OIDC removes long-lived secrets entirely: the cloud provider trusts tokens issued by GitHub for a specific repo and branch, and grants temporary credentials for a least-privilege role."
---

## Why it matters

The fastest, safest teams deploy small changes often, and the research behind the DORA metrics links frequent, low-risk deployment with both higher throughput and higher stability. That only works if building, testing and deploying are automated, repeatable and reversible, and if infrastructure is code that can be reviewed and recreated. This lesson connects your code to production.

## Continuous integration

**CI:** every push and pull request is automatically built and tested, so problems are found in minutes, not at release time.

A solid backend CI pipeline:

1. Install dependencies from the lockfile (cached).
2. Lint and type-check.
3. Unit tests.
4. Integration tests against real dependencies (Postgres and Redis as service containers).
5. Security checks: dependency audit, secret scanning, SAST.
6. Build the container image; scan it.
7. Push the image tagged with the commit SHA (on the main branch).

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: test }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:test@localhost:5432/test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run typecheck
      - run: npm run migrate
      - run: npm test -- --coverage
      - run: npm audit --audit-level=high

  image:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: "${{ github.actor }}", password: "${{ secrets.GITHUB_TOKEN }}" }
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Scan image
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: "1"
          ignore-unfixed: true
```

Practices that matter:

- Keep CI **fast** (under ~10 minutes): cache dependencies and layers, parallelise jobs, run the slowest suites only where needed.
- **Required checks** and branch protection on `main`.
- **Pin third-party actions** to a full commit SHA in security-sensitive pipelines (tags can be moved), and use least-privilege `permissions`.
- Treat **flaky tests** as bugs: quarantine and fix them, or the team learns to ignore red builds.

## Continuous delivery and deployment

- **Continuous delivery:** every change on `main` is *deployable*; promotion to production is a button.
- **Continuous deployment:** every change that passes the pipeline goes to production automatically.

**Build once, deploy many:** the same image digest moves through environments; only configuration changes.

```mermaid
flowchart LR
  PR[Pull request] --> CI[CI: lint, test, scan]
  CI -->|merge| B[Build image @sha]
  B --> STG[Deploy to staging<br/>migrations + smoke tests]
  STG -->|automatic or approval| PROD[Deploy to production<br/>canary → full]
  PROD --> MON[Watch SLOs<br/>auto-rollback on burn]
```

```yaml
# .github/workflows/deploy.yml (excerpt)
jobs:
  deploy-production:
    environment: production              # GitHub environment: required reviewers, scoped secrets
    permissions: { id-token: write, contents: read }
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-api   # OIDC: no stored keys
          aws-region: ap-south-1
      - run: ./scripts/migrate.sh "${{ github.sha }}"                   # backward-compatible migrations first
      - run: ./scripts/deploy.sh "${{ github.sha }}"                    # e.g. update ECS service / Helm release
      - run: ./scripts/smoke-test.sh https://api.example.com
```

With **GitOps**, the pipeline instead commits the new image tag to a deployment repository, and Argo CD or Flux applies it to the cluster.

## Deployment strategies

| Strategy | How | Rollback | Cost | Risk |
| --- | --- | --- | --- | --- |
| **Recreate** | Stop old, start new | Redeploy old | None extra | Downtime |
| **Rolling** | Replace instances gradually | Roll forward or back gradually | Small surge | Mixed versions run together |
| **Blue-green** | Deploy full new environment (green), switch traffic from blue at once | Switch back instantly | 2× capacity during switch | Everyone hits new version at once |
| **Canary** | Send a small % of traffic to the new version, analyse metrics, increase stepwise | Shift traffic back | Small | Lowest blast radius; needs good metrics |
| **Shadow (dark launch)** | Mirror real traffic to the new version without returning its responses | n/a | Extra capacity | Must avoid side effects (no duplicate writes) |

**Canary analysis:** compare the canary's error rate and latency against the baseline over the same period, and promote or roll back automatically (Argo Rollouts, Flagger, AWS CodeDeploy, or service-mesh traffic splitting).

**Database changes** must be compatible with both old and new versions during any rolling or canary deploy, which means expand/contract migrations and never a destructive change in the same release as the code that stops using the old schema.

### Feature flags: decouple deploy from release

Deploy code dark, then release it by flipping a flag, for a percentage of users, internal staff, or one tenant, and turn it off instantly if something goes wrong, with no redeploy.

```ts
if (await flags.isEnabled("new-checkout", { userId: user.id, tenantId: user.orgId })) {
  return newCheckout(cart);
}
return legacyCheckout(cart);
```

Flag types: release toggles (short-lived), ops kill switches (long-lived, for degrading gracefully), experiments (A/B tests), and permission flags. Remove release flags once rolled out, because stale flags become tangled dead code. Tools include LaunchDarkly, Unleash, Flagsmith and OpenFeature (a vendor-neutral API standard).

## Infrastructure as code with Terraform

Clicking around a cloud console creates infrastructure nobody can reproduce or review. **Infrastructure as code** describes resources in files: versioned, reviewed in pull requests, applied by automation, and recreatable.

Terraform (and its open-source fork OpenTofu) is declarative: you describe the desired resources; `plan` shows the diff against reality; `apply` makes it so.

```hcl
# main.tf
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {                                   # remote, encrypted, locked state
    bucket       = "acme-terraform-state"
    key          = "api/prod.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true                            # S3-native state locking (Terraform 1.10+)
  }
}

provider "aws" { region = var.region }

variable "region"      { default = "ap-south-1" }
variable "environment" { type = string }

resource "aws_s3_bucket" "uploads" {
  bucket = "acme-uploads-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

module "db" {                                      # reuse a vetted community or internal module
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"
  identifier        = "api-${var.environment}"
  engine            = "postgres"
  engine_version    = "17"
  instance_class    = "db.t4g.medium"
  allocated_storage = 50
  multi_az          = var.environment == "prod"
  backup_retention_period = 14
  manage_master_user_password = true               # password generated and stored in Secrets Manager
  # networking, subnet groups and security groups omitted for brevity
}

output "uploads_bucket" { value = aws_s3_bucket.uploads.bucket }
```

```bash
terraform init
terraform plan -var environment=staging -out plan.tfplan   # review the diff (do this in the PR)
terraform apply plan.tfplan
```

Essentials:

- **State** maps your code to real resource IDs. Store it remotely, encrypted, with locking, and restrict access: it can contain secrets.
- **Modules** for reuse; **one state per environment** (or per component) to limit blast radius.
- **Plan in pull requests, apply from CI** after review; no manual changes in the console (they cause **drift**, which `plan` will try to undo).
- Alternatives: Pulumi (real programming languages), AWS CDK, CloudFormation, Bicep for Azure, Crossplane (Kubernetes-native).

## Cloud building blocks across providers

| Need | AWS | Google Cloud | Azure |
| --- | --- | --- | --- |
| VMs | EC2 | Compute Engine | Virtual Machines |
| Managed containers | ECS / Fargate, App Runner | Cloud Run | Container Apps |
| Kubernetes | EKS | GKE | AKS |
| Functions | Lambda | Cloud Run functions | Azure Functions |
| Object storage | S3 | Cloud Storage | Blob Storage |
| Managed Postgres | RDS / Aurora | Cloud SQL / AlloyDB | Azure Database for PostgreSQL |
| Key-value / document | DynamoDB | Firestore / Bigtable | Cosmos DB |
| Cache | ElastiCache / MemoryDB | Memorystore | Azure Cache for Redis |
| Queues / pub-sub | SQS, SNS, EventBridge | Pub/Sub | Service Bus, Event Grid |
| Streaming | MSK, Kinesis | Managed Kafka, Pub/Sub | Event Hubs |
| CDN | CloudFront | Cloud CDN | Front Door |
| Secrets | Secrets Manager, SSM Parameter Store | Secret Manager | Key Vault |
| Identity for workloads | IAM roles | Service accounts / Workload Identity | Managed identities |
| Private networking | VPC, subnets, security groups | VPC, firewall rules | VNet, NSGs |

Concepts transfer: **regions** (geographic) contain **availability zones** (isolated datacenters). Spread across AZs for resilience. Put databases in **private subnets** with no public IP, expose only load balancers publicly, and give each workload an identity with least-privilege permissions instead of shared keys.

## Secrets management

- **Never** in source code, images, CI logs or plain Kubernetes manifests.
- Store in a secrets manager (or Vault), inject at runtime as environment variables or mounted files, and scope per service and environment.
- Prefer **workload identity** (IAM roles, Kubernetes service account federation, CI OIDC) over long-lived keys.
- **Rotate** regularly and immediately on suspected exposure; automated rotation for database credentials where supported.
- **Audit** access, and scan repositories and images for leaked secrets.

## Cost awareness (FinOps basics)

Tag every resource with owner, service and environment so costs can be attributed. Common savings: right-sizing over-provisioned instances, autoscaling and scheduling non-production environments off at night, committed-use discounts for steady load, storage lifecycle policies (move old objects to colder tiers), watching **data egress** (often the surprise line item), and deleting orphaned volumes, snapshots and idle load balancers. Set budgets and anomaly alerts.

## Common mistakes

- Building different artefacts per environment.
- Long-lived cloud keys in CI secrets.
- Manual console changes alongside Terraform (drift).
- Terraform state in Git, or local state on one laptop.
- Destructive migrations shipped together with code changes.
- Feature flags never cleaned up.
- No automated rollback criteria.

## Security considerations

- The CI/CD system has production access, so it's a top target: least-privilege tokens, OIDC, protected branches and environments, pinned actions, reviewed workflow changes.
- Supply chain: lockfiles, image scanning, provenance and signing (SLSA, Sigstore) for mature setups.
- Least-privilege IAM per workload, private networking for data stores, and encryption everywhere.

## Performance considerations

- Fast pipelines enable small batches, which reduce risk: cache aggressively and parallelise.
- Canary analysis needs enough traffic and time to be statistically meaningful.

## Hands-on exercise

1. Add the CI workflow above (adapted) to one of your projects: lint, tests with a Postgres service container, `npm audit` or `pip-audit`, image build and Trivy scan, and push to GHCR on `main`.
2. Add branch protection requiring CI to pass.
3. Write Terraform (against LocalStack for free local AWS emulation, or a free tier) for an S3 bucket with public access blocked and versioning, plus a remote state backend.
4. Deploy your app twice using a blue-green approach with Docker Compose and Nginx (two app services, switch the upstream, test rollback), then implement a feature flag that turns a new endpoint on for 10% of users.

## Completion criteria

- Every change you push is automatically tested, scanned and packaged as an immutable image.
- You can write, plan and apply Terraform with remote state, and explain drift.
- You can choose and execute a deployment strategy with a rollback plan, and use feature flags to release safely.
