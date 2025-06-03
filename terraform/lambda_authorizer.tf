module "lambda_authorizer" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.21.0"

  function_name = "${var.environment}_authorizer"
  description   = "${replace(var.environment, "_", " ")} api authorizer function"
  handler       = "app.lambda_handler"
  publish       = true
  runtime       = "python3.13"
  timeout       = 30

  environment_variables = {
    API_KEY_SECRET = aws_secretsmanager_secret.api_key.name
  }

  source_path = [
    {
      path             = "${path.module}/lambda_authorizer"
      pip_requirements = false
    }
  ]

  attach_policies = true
  policies        = ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]

  attach_policy_statements = true
  policy_statements = {
    secrets = {
      effect    = "Allow",
      actions   = ["secretsmanager:*"],
      resources = [aws_secretsmanager_secret.api_key.arn]
    }
  }

  allowed_triggers = {
    AllowExecutionFromAPIGateway = {
      service    = "apigateway"
      source_arn = "${module.api_gateway.api_execution_arn}/*/*"
    }
  }

  cloudwatch_logs_retention_in_days = 3

  tags = var.tags
}

resource "aws_secretsmanager_secret" "api_key" {
  name        = "${var.environment}_api_key"
  description = "${local.environment} API key"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "api_key_version" {
  secret_id = aws_secretsmanager_secret.api_key.id

  secret_string = jsonencode({ "API_KEY" : random_string.api.result })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "random_string" "api" {
  length = 64

  lower   = true
  numeric = true
  special = true
  upper   = true
}
