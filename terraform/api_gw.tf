data "aws_lb" "api" {
  tags = {
    "ingress.k8s.aws/stack" = var.internal_lb_name_tortoise
  }
}

data "aws_lb_listener" "api" {
  load_balancer_arn = data.aws_lb.api.arn
  port              = 80
}

locals {
  api_integration = {
    connection_type = "VPC_LINK"
    method          = "ANY"
    type            = "HTTP_PROXY"
    uri             = data.aws_lb_listener.api.arn
    vpc_link_key    = "vpc"
  }

  api_route_keys = [
    "POST /input",
    "POST /synthesize",
    "GET /outputs",
    "GET /outputs/{proxy+}",
  ]

  api_routes = {
    for route_key in local.api_route_keys : route_key => {
      authorization_type = "JWT"
      authorizer_key     = "cognito"
      integration        = local.api_integration
    }
  }

  cognito_issuer = "https://${aws_cognito_user_pool.main.endpoint}"
}

module "api_gateway" {
  source  = "terraform-aws-modules/apigateway-v2/aws"
  version = "~> 5.4.0"

  name          = var.environment
  description   = "API Gateway for ${var.environment} environment"
  protocol_type = "HTTP"

  authorizers = {
    cognito = {
      authorizer_type  = "JWT"
      identity_sources = ["$request.header.Authorization"]
      name             = "CognitoJWT"
      jwt_configuration = {
        audience = [aws_cognito_user_pool_client.main.id]
        issuer   = local.cognito_issuer
      }
    }
  }

  cors_configuration = {
    allow_headers = ["authorization", "content-type"]
    allow_methods = ["GET", "OPTIONS", "POST"]
    allow_origins = [
      "https://${local.domain_name}",
      "http://localhost:5173",
    ]
  }

  create_certificate    = false
  create_domain_name    = true
  create_domain_records = false

  domain_name                 = local.domain_name
  domain_name_certificate_arn = aws_acm_certificate.this.arn

  disable_execute_api_endpoint = false

  stage_access_log_settings = {
    create_log_group            = true
    log_group_retention_in_days = 3
  }

  stage_default_route_settings = {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 50
    throttling_rate_limit    = 50
  }

  routes = local.api_routes

  vpc_links = {
    vpc = {
      name               = var.environment
      security_group_ids = [aws_security_group.apigw_vpc_link.id]
      subnet_ids         = concat(module.vpc.private_subnets)
    }
  }

  tags = var.tags

  depends_on = [aws_cognito_user_pool_client.main]
}

resource "aws_security_group" "apigw_vpc_link" {
  name        = "${var.environment}_sg"
  vpc_id      = module.vpc.vpc_id
  description = "${var.environment} security group"
  tags        = merge(var.tags, { Name = "${var.environment}_sg" })
}

resource "aws_security_group_rule" "api_gw_vpc_link_egress" {
  type        = "egress"
  protocol    = -1
  from_port   = 0
  to_port     = 0
  cidr_blocks = [module.vpc.vpc_cidr_block]

  security_group_id = aws_security_group.apigw_vpc_link.id
}

resource "aws_security_group_rule" "api_gw_vpc_link_ingress" {
  type        = "ingress"
  protocol    = -1
  from_port   = 0
  to_port     = 0
  cidr_blocks = [module.vpc.vpc_cidr_block]

  security_group_id = aws_security_group.apigw_vpc_link.id
}
