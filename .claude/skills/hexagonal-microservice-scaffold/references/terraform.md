# Terraform — Service-Level Scaffold

Terraform scaffolding is a **separate step** done after application code is complete. Never mix Terraform questions into the application code Step 0 — ask them only when the user explicitly requests infrastructure scaffolding, adds Terraform to an existing service, or says things like "scaffold the infra" / "add Terraform" / "set up AWS resources".

---

## Terraform Step 0 — Gather context

Ask before generating any files:

1. **Compute type** — Lambda (zip package or container image?) or ECS Fargate? Never guess — always ask.
2. **Infrastructure services** — Which does this service use? For each, ask for name identifiers (freeform labels that distinguish multiple resources of the same type):
   - **SQS** — How many queues? Give each a name identifier (e.g. `default`, `shipping`). DLQ per queue? (default: yes)
   - **SNS** — How many topics? Name identifiers?
   - **EventBridge** — Custom event bus or default bus? Any rules?
   - **MSK / Kafka** — Cluster name?
   - **RDS / Postgres** — Instance size? Multi-AZ?
   - **DynamoDB** — How many tables? Name identifiers, partition key, sort key, billing mode?
   - **Redis / ElastiCache** — Node type?
   - **API Gateway** — Default: one HTTP API v2 per service. Confirm or skip.
   - **Route 53** — Custom domain for the API? Hosted zone name?
   - **SSM Parameter Store** — List parameter paths and types (String vs SecureString).
   - **Cloudwatch** - Group logs, alarms?
3. **VPC** — Create a new VPC or use an existing one? If existing: how to look it up (by tag `Name`, by ID, by other tag)?
4. **CI/CD system** — GitHub Actions, GitLab CI, or other? If not specified: default to GitHub Actions. Production apply is CI-only; staging can be manual or CI.
5. **Environment names** — Default: `dev`, `staging`, `prd`. Confirm or customize.
6. **S3 bucket name** — Remote state bucket (e.g. `my-company-terraform-state`).
7. **DynamoDB lock table name** — Default: `terraform-state-lock`. Confirm.

---

## Directory structure

```
# Per-service
services/<domain>/terraform/
├── main.tf              # provider + module calls
├── variables.tf         # all input variables
├── outputs.tf           # exported ARNs, URLs, IDs
├── locals.tf            # naming convention + common tags
├── data.tf              # data sources for existing resources
├── backend.tf           # partial S3 backend (key only)
├── environments/
│   ├── dev.tfvars
│   ├── staging.tfvars
│   ├── prd.tfvars
│   ├── dev.tfbackend
│   ├── staging.tfbackend
│   └── prd.tfbackend
└── Makefile

# Root-level shared modules (created once, referenced by all services)
terraform/
└── modules/
    ├── vpc/
    ├── sqs/
    ├── sns/
    ├── eventbridge/
    ├── postgres-rds/
    ├── dynamodb/
    ├── redis/
    ├── msk-kafka/
    ├── ecs-fargate/
    ├── lambda/
    ├── api-gateway/
    ├── route53/
    └── ssm/
```

Before scaffolding: check whether `terraform/modules/` already exists at the repo root. Only create the modules the service needs that are not already present. Each module is a subdirectory with `main.tf`, `variables.tf`, and `outputs.tf`. See `references/terraform-modules.md` for module contents.

---

## File templates

### `variables.tf`

Always include the base variables. Add resource-specific variables below them.

```hcl
variable "service_name" {
  description = "Name of the service (e.g. orders, payments)"
  type        = string
}

variable "env" {
  description = "Deployment environment (dev, staging, prd)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}
```

Add resource-specific variables as needed. For example, if the service has multiple SQS queues:

```hcl
variable "sqs_queues" {
  description = "Map of SQS queue name identifiers to configuration"
  type = map(object({
    delay_seconds              = optional(number, 0)
    visibility_timeout_seconds = optional(number, 30)
    create_dlq                 = optional(bool, true)
    max_receive_count          = optional(number, 5)
  }))
  default = {}
}
```

For dynamic resources (multiple queues, topics, tables), prefer a `map(object(...))` variable over one variable per resource — it scales cleanly when the user adds a third queue later.

### `locals.tf`

Naming convention: `${var.service_name}-${identifier}-${var.env}-${resource_type}`
Examples: `orders-default-prd-queue`, `orders-shipping-prd-queue`, `orders-payments-prd-topic`

```hcl
locals {
  prefix = "${var.service_name}-${var.env}"

  common_tags = {
    Service     = var.service_name
    Environment = var.env
    ManagedBy   = "terraform"
  }
}
```

Resource names are composed inside each module call using `local.prefix`:
```hcl
module "sqs_default" {
  source = "../../../terraform/modules/sqs"
  name   = "${local.prefix}-default-queue"
  ...
}
```

### `backend.tf`

Only the state key lives here. Bucket, region, and lock table come from the `.tfbackend` environment file, keeping secrets and environment-specific config out of committed code.

```hcl
terraform {
  backend "s3" {
    key     = "<domain>/terraform.tfstate"
    encrypt = true
  }
}
```

### `data.tf`

Only include data sources for **existing** infrastructure the user said is pre-existing. If the user asked to create the VPC, use the VPC module in `main.tf` instead.

```hcl
# Example: look up existing VPC by Name tag
data "aws_vpc" "main" {
  tags = {
    Name = "${var.service_name}-${var.env}-vpc"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  tags = { Tier = "private" }
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  tags = { Tier = "public" }
}
```

### `main.tf`

Provider + `required_providers` + one module block per infrastructure resource. Only include modules for infrastructure the service actually uses.

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── VPC (only if creating new) ────────────────────────────────────────────────
module "vpc" {
  source       = "../../../terraform/modules/vpc"
  name         = "${local.prefix}-vpc"
  cidr         = "10.0.0.0/16"
  azs          = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  tags         = local.common_tags
}

# ── SQS (one module block per queue) ─────────────────────────────────────────
module "sqs_default" {
  source            = "../../../terraform/modules/sqs"
  name              = "${local.prefix}-default-queue"
  create_dlq        = true
  max_receive_count = 5
  tags              = local.common_tags
}

module "sqs_shipping" {
  source            = "../../../terraform/modules/sqs"
  name              = "${local.prefix}-shipping-queue"
  create_dlq        = true
  max_receive_count = 5
  tags              = local.common_tags
}

# ── ECS Fargate ───────────────────────────────────────────────────────────────
module "ecs" {
  source          = "../../../terraform/modules/ecs-fargate"
  name            = "${local.prefix}-service"
  cluster_name    = "${local.prefix}-cluster"
  container_image = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.service_name}:latest"
  container_port  = 3000
  cpu             = 256
  memory          = 512
  desired_count   = 1
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  tags            = local.common_tags
}

# ── API Gateway ───────────────────────────────────────────────────────────────
module "api_gateway" {
  source      = "../../../terraform/modules/api-gateway"
  name        = "${local.prefix}-api"
  description = "${var.service_name} HTTP API (${var.env})"
  tags        = local.common_tags
}
```

For dynamic resources using a `map(object(...))` variable, use `for_each`:

```hcl
module "sqs_queues" {
  for_each          = var.sqs_queues
  source            = "../../../terraform/modules/sqs"
  name              = "${local.prefix}-${each.key}-queue"
  create_dlq        = each.value.create_dlq
  max_receive_count = each.value.max_receive_count
  tags              = local.common_tags
}
```

### `outputs.tf`

Export every ARN and URL the application config references. These are what you'd write into SSM parameters or use in other Terraform configurations.

```hcl
output "sqs_default_url" {
  description = "URL of the default SQS queue"
  value       = module.sqs_default.queue_url
}

output "sqs_default_arn" {
  description = "ARN of the default SQS queue"
  value       = module.sqs_default.queue_arn
}

output "api_gateway_endpoint" {
  description = "Invoke URL of the HTTP API"
  value       = module.api_gateway.api_endpoint
}
```

---

## Environment files

### `environments/<env>.tfvars`

```hcl
service_name   = "orders"
env            = "prd"
aws_region     = "us-east-1"
aws_account_id = "123456789012"

# Resource-specific values per environment:
sqs_queues = {
  default = {
    delay_seconds              = 0
    visibility_timeout_seconds = 30
    create_dlq                 = true
    max_receive_count          = 5
  }
  shipping = {
    delay_seconds              = 0
    visibility_timeout_seconds = 60
    create_dlq                 = true
    max_receive_count          = 3
  }
}
```

### `environments/<env>.tfbackend`

Contains bucket, region, and lock table — nothing sensitive.

```hcl
bucket         = "my-company-terraform-state"
region         = "us-east-1"
dynamodb_table = "terraform-state-lock"
```

---

## Makefile

```makefile
ENV     ?= dev
BACKEND := environments/$(ENV).tfbackend
VARS    := environments/$(ENV).tfvars

.PHONY: init plan apply destroy fmt validate

init:
	terraform init -backend-config=$(BACKEND) -reconfigure

plan: init
	terraform plan -var-file=$(VARS)

apply: init
	terraform apply -var-file=$(VARS)

destroy: init
	terraform destroy -var-file=$(VARS)

fmt:
	terraform fmt -recursive .

validate: init
	terraform validate
```

Usage: `ENV=prd make plan` — if `ENV` is omitted it defaults to `dev`.

---

## CI/CD — GitHub Actions

Create `.github/workflows/<domain>-terraform.yml`.

**Policy**: staging can apply manually or on push to `main`; production applies only on push to `main` (never via `workflow_dispatch`). This gate ensures prod never gets ahead of staging.

Use OIDC (`id-token: write`) instead of static AWS credentials.

```yaml
name: <domain> Terraform

on:
  push:
    branches: [main]
    paths:
      - 'services/<domain>/terraform/**'
      - 'terraform/modules/**'
  pull_request:
    paths:
      - 'services/<domain>/terraform/**'
      - 'terraform/modules/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to apply (staging only)'
        required: true
        default: staging
        type: choice
        options: [staging]

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  plan-staging:
    name: Plan (staging)
    runs-on: ubuntu-latest
    environment: staging
    defaults:
      run:
        working-directory: services/<domain>/terraform
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN_STAGING }}
          aws-region: us-east-1
      - uses: hashicorp/setup-terraform@v3
      - run: make ENV=staging init
      - run: make ENV=staging plan

  apply-staging:
    name: Apply (staging)
    needs: plan-staging
    if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    environment: staging
    defaults:
      run:
        working-directory: services/<domain>/terraform
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN_STAGING }}
          aws-region: us-east-1
      - uses: hashicorp/setup-terraform@v3
      - run: make ENV=staging apply

  plan-prd:
    name: Plan (prd)
    needs: apply-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: prd
    defaults:
      run:
        working-directory: services/<domain>/terraform
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN_PRD }}
          aws-region: us-east-1
      - uses: hashicorp/setup-terraform@v3
      - run: make ENV=prd init
      - run: make ENV=prd plan

  apply-prd:
    name: Apply (prd)
    needs: plan-prd
    runs-on: ubuntu-latest
    environment: prd
    defaults:
      run:
        working-directory: services/<domain>/terraform
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN_PRD }}
          aws-region: us-east-1
      - uses: hashicorp/setup-terraform@v3
      - run: make ENV=prd apply
```

GitHub secrets required (set per environment in repo settings):
- `AWS_ROLE_ARN_STAGING` — IAM role ARN the runner assumes for staging
- `AWS_ROLE_ARN_PRD` — IAM role ARN the runner assumes for prod

---

## Quality checklist

- [ ] `backend.tf` contains only the `key` — no bucket, region, or lock table hardcoded
- [ ] `.tfbackend` files committed for every environment (they contain no secrets)
- [ ] `.tfvars` files committed for every environment
- [ ] `locals.tf` defines `prefix` and `common_tags`; all resource names derive from `local.prefix`
- [ ] Every module call passes `tags = local.common_tags`
- [ ] DLQ created for every SQS queue unless user explicitly declined
- [ ] `outputs.tf` exports every ARN/URL the application references
- [ ] Makefile has `init`, `plan`, `apply`, `destroy`, `fmt`, `validate` targets
- [ ] If CI/CD requested: prod apply is gated behind staging apply; no manual prod dispatch
- [ ] If creating VPC: public and private subnets in at least 2 AZs, NAT gateway for private subnets
- [ ] State key is `<domain>/terraform.tfstate` — unique per service, never shared
- [ ] Root `terraform/modules/` checked before creating — only add missing modules
