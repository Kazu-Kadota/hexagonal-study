# Terraform Modules — Reference Templates

Each module lives at `terraform/modules/<name>/` in the repository root and contains three files: `main.tf`, `variables.tf`, `outputs.tf`. Modules are created once and referenced by any service that needs them.

Module convention: every module accepts a `name` variable (the fully-composed resource name, e.g. `orders-prd-default-queue`) and a `tags` map. The caller is responsible for composing the name — modules never build names internally.

---

## vpc

Creates a VPC with public and private subnets across multiple AZs, an Internet Gateway, NAT Gateways (one per AZ in prod, one shared in dev/staging), and route tables.

### `variables.tf`
```hcl
variable "name" {
  description = "Base name for VPC and subnet resources"
  type        = string
}

variable "cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "List of Availability Zones to use"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "single_nat_gateway" {
  description = "Use a single shared NAT gateway (cost savings for non-prod)"
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

### `main.tf`
```hcl
resource "aws_vpc" "this" {
  cidr_block           = var.cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(var.tags, { Name = var.name })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(var.tags, { Name = "${var.name}-igw" })
}

resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.azs[count.index]
  tags              = merge(var.tags, { Name = "${var.name}-private-${var.azs[count.index]}", Tier = "private" })
}

resource "aws_subnet" "public" {
  count                   = length(var.azs)
  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true
  tags                    = merge(var.tags, { Name = "${var.name}-public-${var.azs[count.index]}", Tier = "public" })
}

resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : length(var.azs)
  domain = "vpc"
  tags   = merge(var.tags, { Name = "${var.name}-nat-eip-${count.index}" })
}

resource "aws_nat_gateway" "this" {
  count         = var.single_nat_gateway ? 1 : length(var.azs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  tags          = merge(var.tags, { Name = "${var.name}-nat-${count.index}" })
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(var.tags, { Name = "${var.name}-public-rt" })
}

resource "aws_route_table_association" "public" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(var.azs)
  vpc_id = aws_vpc.this.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.single_nat_gateway ? aws_nat_gateway.this[0].id : aws_nat_gateway.this[count.index].id
  }
  tags = merge(var.tags, { Name = "${var.name}-private-rt-${count.index}" })
}

resource "aws_route_table_association" "private" {
  count          = length(var.azs)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
```

### `outputs.tf`
```hcl
output "vpc_id"             { value = aws_vpc.this.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "public_subnet_ids"  { value = aws_subnet.public[*].id }
output "vpc_cidr"           { value = aws_vpc.this.cidr_block }
```

---

## sqs

Standard SQS queue with optional dead-letter queue. Always create a DLQ unless the user explicitly declines — it prevents silent message loss.

### `variables.tf`
```hcl
variable "name" {
  description = "Queue name (fully composed by caller)"
  type        = string
}

variable "visibility_timeout_seconds" {
  type    = number
  default = 30
}

variable "message_retention_seconds" {
  type    = number
  default = 345600 # 4 days
}

variable "delay_seconds" {
  type    = number
  default = 0
}

variable "create_dlq" {
  description = "Whether to create a dead-letter queue"
  type        = bool
  default     = true
}

variable "max_receive_count" {
  description = "Number of receives before a message moves to the DLQ"
  type        = number
  default     = 5
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

### `main.tf`
```hcl
resource "aws_sqs_queue" "dlq" {
  count                     = var.create_dlq ? 1 : 0
  name                      = "${var.name}-dlq"
  message_retention_seconds = 1209600 # 14 days for DLQ
  tags                      = var.tags
}

resource "aws_sqs_queue" "this" {
  name                       = var.name
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  delay_seconds              = var.delay_seconds

  redrive_policy = var.create_dlq ? jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[0].arn
    maxReceiveCount     = var.max_receive_count
  }) : null

  tags = var.tags
}
```

### `outputs.tf`
```hcl
output "queue_url"  { value = aws_sqs_queue.this.url }
output "queue_arn"  { value = aws_sqs_queue.this.arn }
output "queue_name" { value = aws_sqs_queue.this.name }
output "dlq_arn"    { value = var.create_dlq ? aws_sqs_queue.dlq[0].arn : null }
output "dlq_url"    { value = var.create_dlq ? aws_sqs_queue.dlq[0].url : null }
```

---

## sns

SNS topic with optional SQS subscriptions. The caller wires topic → queue subscriptions by passing queue ARNs.

### `variables.tf`
```hcl
variable "name" {
  type = string
}

variable "sqs_subscriptions" {
  description = "Map of label → SQS queue ARN to subscribe to this topic"
  type        = map(string)
  default     = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

### `main.tf`
```hcl
resource "aws_sns_topic" "this" {
  name = var.name
  tags = var.tags
}

resource "aws_sns_topic_subscription" "sqs" {
  for_each  = var.sqs_subscriptions
  topic_arn = aws_sns_topic.this.arn
  protocol  = "sqs"
  endpoint  = each.value
}

resource "aws_sqs_queue_policy" "allow_sns" {
  for_each  = var.sqs_subscriptions
  queue_url = each.value # caller passes queue URLs separately if needed; omit if caller handles policy
  policy    = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = each.value
      Condition = { ArnEquals = { "aws:SourceArn" = aws_sns_topic.this.arn } }
    }]
  })
}
```

> Note: `aws_sqs_queue_policy` requires the queue URL. If the caller is passing only ARNs, remove `aws_sqs_queue_policy` from this module and let the caller manage the queue policy separately. Adapt based on what the caller provides.

### `outputs.tf`
```hcl
output "topic_arn"  { value = aws_sns_topic.this.arn }
output "topic_name" { value = aws_sns_topic.this.name }
```

---

## eventbridge

Custom EventBridge event bus with optional rules and SQS/Lambda targets.

### `variables.tf`
```hcl
variable "name" {
  description = "Event bus name"
  type        = string
}

variable "rules" {
  description = "Map of rule name → rule config"
  type = map(object({
    description   = optional(string, "")
    event_pattern = string
    targets = list(object({
      id  = string
      arn = string
    }))
  }))
  default = {}
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

### `main.tf`
```hcl
resource "aws_cloudwatch_event_bus" "this" {
  name = var.name
  tags = var.tags
}

resource "aws_cloudwatch_event_rule" "this" {
  for_each      = var.rules
  name          = each.key
  description   = each.value.description
  event_bus_name = aws_cloudwatch_event_bus.this.name
  event_pattern = each.value.event_pattern
  tags          = var.tags
}

resource "aws_cloudwatch_event_target" "this" {
  for_each = {
    for pair in flatten([
      for rule_name, rule in var.rules : [
        for target in rule.targets : {
          key       = "${rule_name}-${target.id}"
          rule_name = rule_name
          target    = target
        }
      ]
    ]) : pair.key => pair
  }
  rule           = aws_cloudwatch_event_rule.this[each.value.rule_name].name
  event_bus_name = aws_cloudwatch_event_bus.this.name
  target_id      = each.value.target.id
  arn            = each.value.target.arn
}
```

### `outputs.tf`
```hcl
output "event_bus_name" { value = aws_cloudwatch_event_bus.this.name }
output "event_bus_arn"  { value = aws_cloudwatch_event_bus.this.arn }
```

---

## postgres-rds

RDS Postgres instance with parameter group, subnet group, and security group. Multi-AZ and deletion protection are toggled per environment.

### `variables.tf`
```hcl
variable "name"              { type = string }
variable "vpc_id"            { type = string }
variable "subnet_ids"        { type = list(string) }
variable "db_name"           { type = string }
variable "username"          { type = string }
variable "password"          { type = string; sensitive = true }
variable "instance_class"    { type = string; default = "db.t3.micro" }
variable "engine_version"    { type = string; default = "16.3" }
variable "allocated_storage" { type = number; default = 20 }
variable "multi_az"          { type = bool;   default = false }
variable "deletion_protection" { type = bool; default = true }
variable "allowed_cidr_blocks" { type = list(string); default = [] }
variable "tags"              { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_security_group" "rds" {
  name   = "${var.name}-rds-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name}-pg16"
  family = "postgres16"
  tags   = var.tags
}

resource "aws_db_instance" "this" {
  identifier              = var.name
  engine                  = "postgres"
  engine_version          = var.engine_version
  instance_class          = var.instance_class
  allocated_storage       = var.allocated_storage
  db_name                 = var.db_name
  username                = var.username
  password                = var.password
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  parameter_group_name    = aws_db_parameter_group.this.name
  multi_az                = var.multi_az
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = !var.deletion_protection
  storage_encrypted       = true
  tags                    = var.tags
}
```

### `outputs.tf`
```hcl
output "endpoint"    { value = aws_db_instance.this.endpoint }
output "db_name"     { value = aws_db_instance.this.db_name }
output "port"        { value = aws_db_instance.this.port }
output "instance_id" { value = aws_db_instance.this.id }
```

---

## dynamodb

DynamoDB table with optional GSIs and configurable billing mode.

### `variables.tf`
```hcl
variable "name"         { type = string }
variable "hash_key"     { type = string }
variable "range_key"    { type = string; default = null }
variable "billing_mode" { type = string; default = "PAY_PER_REQUEST" }

variable "attributes" {
  description = "List of attribute definitions (name + type S/N/B)"
  type        = list(object({ name = string; type = string }))
}

variable "global_secondary_indexes" {
  type = list(object({
    name            = string
    hash_key        = string
    range_key       = optional(string)
    projection_type = optional(string, "ALL")
  }))
  default = []
}

variable "point_in_time_recovery" { type = bool; default = true }
variable "tags"                   { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_dynamodb_table" "this" {
  name         = var.name
  billing_mode = var.billing_mode
  hash_key     = var.hash_key
  range_key    = var.range_key

  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }
  }

  dynamic "global_secondary_index" {
    for_each = var.global_secondary_indexes
    content {
      name            = global_secondary_index.value.name
      hash_key        = global_secondary_index.value.hash_key
      range_key       = global_secondary_index.value.range_key
      projection_type = global_secondary_index.value.projection_type
    }
  }

  point_in_time_recovery { enabled = var.point_in_time_recovery }
  server_side_encryption { enabled = true }

  tags = var.tags
}
```

### `outputs.tf`
```hcl
output "table_name" { value = aws_dynamodb_table.this.name }
output "table_arn"  { value = aws_dynamodb_table.this.arn }
```

---

## redis

ElastiCache Redis cluster (cluster mode disabled, single node by default).

### `variables.tf`
```hcl
variable "name"           { type = string }
variable "vpc_id"         { type = string }
variable "subnet_ids"     { type = list(string) }
variable "node_type"      { type = string; default = "cache.t3.micro" }
variable "engine_version" { type = string; default = "7.1" }
variable "num_cache_nodes" { type = number; default = 1 }
variable "allowed_cidr_blocks" { type = list(string); default = [] }
variable "tags"           { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_security_group" "redis" {
  name   = "${var.name}-redis-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name}-subnet-group"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_cluster" "this" {
  cluster_id           = var.name
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.redis.id]
  tags                 = var.tags
}
```

### `outputs.tf`
```hcl
output "endpoint"      { value = aws_elasticache_cluster.this.cache_nodes[0].address }
output "port"          { value = aws_elasticache_cluster.this.cache_nodes[0].port }
output "cluster_id"    { value = aws_elasticache_cluster.this.id }
```

---

## msk-kafka

Amazon MSK (Managed Streaming for Kafka) cluster with 3 brokers across AZs.

### `variables.tf`
```hcl
variable "name"           { type = string }
variable "vpc_id"         { type = string }
variable "subnet_ids"     { type = list(string) }
variable "kafka_version"  { type = string; default = "3.6.0" }
variable "instance_type"  { type = string; default = "kafka.t3.small" }
variable "number_of_nodes" { type = number; default = 3 }
variable "ebs_volume_size" { type = number; default = 20 }
variable "allowed_cidr_blocks" { type = list(string); default = [] }
variable "tags"           { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_security_group" "msk" {
  name   = "${var.name}-msk-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 9092
    to_port     = 9098
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_msk_configuration" "this" {
  name              = "${var.name}-config"
  kafka_versions    = [var.kafka_version]
  server_properties = <<-EOT
    auto.create.topics.enable=false
    default.replication.factor=3
    min.insync.replicas=2
    num.partitions=6
    log.retention.hours=168
  EOT
}

resource "aws_msk_cluster" "this" {
  cluster_name           = var.name
  kafka_version          = var.kafka_version
  number_of_broker_nodes = var.number_of_nodes

  broker_node_group_info {
    instance_type   = var.instance_type
    client_subnets  = var.subnet_ids
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info { volume_size = var.ebs_volume_size }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.this.arn
    revision = aws_msk_configuration.this.latest_revision
  }

  encryption_info {
    encryption_in_transit { client_broker = "TLS_PLAINTEXT" }
  }

  tags = var.tags
}
```

### `outputs.tf`
```hcl
output "cluster_arn"        { value = aws_msk_cluster.this.arn }
output "bootstrap_brokers"  { value = aws_msk_cluster.this.bootstrap_brokers }
output "zookeeper_connect"  { value = aws_msk_cluster.this.zookeeper_connect_string }
```

---

## ecs-fargate

ECS Fargate service: cluster, task definition, IAM execution role, service, and security group. The caller provides the container image and VPC/subnet info.

### `variables.tf`
```hcl
variable "name"            { type = string }
variable "cluster_name"    { type = string }
variable "container_image" { type = string }
variable "container_port"  { type = number; default = 3000 }
variable "cpu"             { type = number; default = 256 }
variable "memory"          { type = number; default = 512 }
variable "desired_count"   { type = number; default = 1 }
variable "vpc_id"          { type = string }
variable "subnet_ids"      { type = list(string) }
variable "assign_public_ip" { type = bool; default = false }

variable "environment_variables" {
  description = "Container environment variables"
  type        = list(object({ name = string; value = string }))
  default     = []
}

variable "secrets" {
  description = "Secrets from SSM Parameter Store or Secrets Manager"
  type        = list(object({ name = string; valueFrom = string }))
  default     = []
}

variable "allowed_cidr_blocks" { type = list(string); default = ["0.0.0.0/0"] }
variable "tags"               { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_ecs_cluster" "this" {
  name = var.cluster_name
  tags = var.tags
}

resource "aws_iam_role" "execution" {
  name = "${var.name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name = "${var.name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_security_group" "service" {
  name   = "${var.name}-ecs-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = var.container_port
    to_port     = var.container_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/ecs/${var.name}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = var.name
    image     = var.container_image
    essential = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    environment = var.environment_variables
    secrets     = var.secrets

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.this.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])

  tags = var.tags
}

data "aws_region" "current" {}

resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = var.assign_public_ip
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = var.tags
}
```

### `outputs.tf`
```hcl
output "cluster_arn"      { value = aws_ecs_cluster.this.arn }
output "cluster_name"     { value = aws_ecs_cluster.this.name }
output "service_name"     { value = aws_ecs_service.this.name }
output "task_role_arn"    { value = aws_iam_role.task.arn }
output "execution_role_arn" { value = aws_iam_role.execution.arn }
output "security_group_id" { value = aws_security_group.service.id }
output "log_group_name"   { value = aws_cloudwatch_log_group.this.name }
```

---

## lambda

Lambda function with IAM execution role. Supports both zip (S3) and container image deployments. Add triggers (SQS event source, API Gateway, EventBridge) as needed in the caller's `main.tf`.

### `variables.tf`
```hcl
variable "name"         { type = string }
variable "package_type" {
  description = "Zip or Image"
  type        = string
  default     = "Zip"
  validation {
    condition     = contains(["Zip", "Image"], var.package_type)
    error_message = "package_type must be Zip or Image"
  }
}

# For Zip deployments
variable "s3_bucket" { type = string; default = null }
variable "s3_key"    { type = string; default = null }
variable "handler"   { type = string; default = "index.handler" }
variable "runtime"   { type = string; default = "nodejs22.x" }

# For Image deployments
variable "image_uri" { type = string; default = null }

variable "timeout"        { type = number; default = 30 }
variable "memory_size"    { type = number; default = 256 }
variable "architectures"  { type = list(string); default = ["arm64"] }

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "vpc_config" {
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

variable "additional_policies" {
  description = "ARNs of additional IAM policies to attach to the Lambda execution role"
  type        = list(string)
  default     = []
}

variable "tags" { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_iam_role" "this" {
  name = "${var.name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "basic" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "vpc" {
  count      = var.vpc_config != null ? 1 : 0
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "additional" {
  count      = length(var.additional_policies)
  role       = aws_iam_role.this.name
  policy_arn = var.additional_policies[count.index]
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_lambda_function" "this" {
  function_name = var.name
  role          = aws_iam_role.this.arn
  timeout       = var.timeout
  memory_size   = var.memory_size
  architectures = var.architectures
  package_type  = var.package_type

  # Zip deployment
  s3_bucket = var.package_type == "Zip" ? var.s3_bucket : null
  s3_key    = var.package_type == "Zip" ? var.s3_key : null
  handler   = var.package_type == "Zip" ? var.handler : null
  runtime   = var.package_type == "Zip" ? var.runtime : null

  # Container image deployment
  image_uri = var.package_type == "Image" ? var.image_uri : null

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }

  depends_on = [aws_cloudwatch_log_group.this]
  tags       = var.tags
}
```

### `outputs.tf`
```hcl
output "function_name" { value = aws_lambda_function.this.function_name }
output "function_arn"  { value = aws_lambda_function.this.arn }
output "invoke_arn"    { value = aws_lambda_function.this.invoke_arn }
output "role_arn"      { value = aws_iam_role.this.arn }
output "role_name"     { value = aws_iam_role.this.name }
```

---

## api-gateway

HTTP API (API Gateway v2) with a `$default` stage and auto-deploy. Routes are added by the caller after integrating with Lambda or an ECS service via VPC Link.

### `variables.tf`
```hcl
variable "name"        { type = string }
variable "description" { type = string; default = "" }

variable "cors_configuration" {
  type = object({
    allow_origins = list(string)
    allow_methods = list(string)
    allow_headers = list(string)
  })
  default = {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
  }
}

variable "tags" { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_apigatewayv2_api" "this" {
  name          = var.name
  protocol_type = "HTTP"
  description   = var.description

  cors_configuration {
    allow_origins = var.cors_configuration.allow_origins
    allow_methods = var.cors_configuration.allow_methods
    allow_headers = var.cors_configuration.allow_headers
  }

  tags = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}
```

### `outputs.tf`
```hcl
output "api_id"       { value = aws_apigatewayv2_api.this.id }
output "api_endpoint" { value = aws_apigatewayv2_api.this.api_endpoint }
output "stage_id"     { value = aws_apigatewayv2_stage.default.id }
```

---

## route53

Creates an A record alias pointing to an API Gateway or ALB. Looks up the hosted zone by name.

### `variables.tf`
```hcl
variable "zone_name"   { type = string; description = "e.g. example.com" }
variable "record_name" { type = string; description = "e.g. orders.api.example.com" }

variable "alias_target" {
  type = object({
    dns_name               = string
    zone_id                = string
    evaluate_target_health = bool
  })
}

variable "tags" { type = map(string); default = {} }
```

### `main.tf`
```hcl
data "aws_route53_zone" "this" {
  name         = var.zone_name
  private_zone = false
}

resource "aws_route53_record" "this" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.record_name
  type    = "A"

  alias {
    name                   = var.alias_target.dns_name
    zone_id                = var.alias_target.zone_id
    evaluate_target_health = var.alias_target.evaluate_target_health
  }
}
```

### `outputs.tf`
```hcl
output "fqdn"    { value = aws_route53_record.this.fqdn }
output "zone_id" { value = data.aws_route53_zone.this.zone_id }
```

---

## ssm

SSM Parameter Store parameters. Use `SecureString` for secrets (database passwords, API keys); `String` for non-sensitive config (queue URLs, ARNs, endpoints the app reads at startup).

### `variables.tf`
```hcl
variable "parameters" {
  description = "Map of parameter name → config"
  type = map(object({
    value       = string
    description = optional(string, "")
    type        = optional(string, "String")  # String | SecureString
    tier        = optional(string, "Standard")
  }))
  sensitive = true
}

variable "tags" { type = map(string); default = {} }
```

### `main.tf`
```hcl
resource "aws_ssm_parameter" "this" {
  for_each    = var.parameters
  name        = each.key
  value       = each.value.value
  description = each.value.description
  type        = each.value.type
  tier        = each.value.tier
  tags        = var.tags
}
```

### `outputs.tf`
```hcl
output "parameter_arns" {
  value = { for k, v in aws_ssm_parameter.this : k => v.arn }
}
output "parameter_names" {
  value = { for k, v in aws_ssm_parameter.this : k => v.name }
}
```

---

## Wiring example — orders service using SQS + ECS Fargate + API Gateway

This shows how a `main.tf` assembles modules for a typical service. Adapt freely.

```hcl
module "vpc" {
  source             = "../../../terraform/modules/vpc"
  name               = "${local.prefix}-vpc"
  cidr               = "10.0.0.0/16"
  azs                = ["${var.aws_region}a", "${var.aws_region}b"]
  single_nat_gateway = var.env != "prd"
  tags               = local.common_tags
}

module "sqs_default" {
  source            = "../../../terraform/modules/sqs"
  name              = "${local.prefix}-default-queue"
  create_dlq        = true
  max_receive_count = 5
  tags              = local.common_tags
}

module "ecs" {
  source          = "../../../terraform/modules/ecs-fargate"
  name            = "${local.prefix}-service"
  cluster_name    = "${local.prefix}-cluster"
  container_image = "${var.aws_account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/orders:latest"
  container_port  = 3000
  cpu             = 512
  memory          = 1024
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  environment_variables = [
    { name = "SQS_QUEUE_URL", value = module.sqs_default.queue_url },
    { name = "NODE_ENV",      value = var.env }
  ]
  tags = local.common_tags
}

module "api_gateway" {
  source      = "../../../terraform/modules/api-gateway"
  name        = "${local.prefix}-api"
  description = "Orders HTTP API (${var.env})"
  tags        = local.common_tags
}

# Grant the ECS task role permission to send to SQS
resource "aws_iam_role_policy" "ecs_sqs" {
  name = "sqs-access"
  role = module.ecs.task_role_arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
      Resource = module.sqs_default.queue_arn
    }]
  })
}
```
