data "aws_ecr_image" "latest" {
  for_each = var.ecr_repos

  repository_name = module.ecr[each.key].repository_name
  most_recent     = true
}

module "ecr" {
  source  = "terraform-aws-modules/ecr/aws"
  version = "~> 2.4.0"

  for_each = var.ecr_repos

  repository_name = "${var.environment}/${each.value}"

  repository_lifecycle_policy = jsonencode({
    rules = [
      {
        action = {
          type = "expire"
        }
        description  = "lifecycle"
        rulePriority = 1
        selection = {
          countNumber = 5
          countType   = "imageCountMoreThan"
          tagStatus   = "untagged"
        }
      }
    ]
  })

  repository_force_delete = true

  tags = var.tags
}

resource "null_resource" "build_and_push_image" {
  for_each = var.ecr_repos

  triggers = {
    app_py_hash     = filesha256("../docker/${each.key}/app.py")
    dockerfile_hash = filesha256("../docker/${each.key}/Dockerfile")
  }

  provisioner "local-exec" {
    command = <<EOT
      set -e
      TAG=$(date +%Y%m%d%H%M%S)
      REPO_URL=${module.ecr[each.key].repository_url}

      echo "Logging in to ECR..."
      aws ecr get-login-password | docker login --username AWS --password-stdin $REPO_URL

      echo "Building and pushing with buildx..."
      docker buildx build \
        --platform linux/amd64 \
        --push \
        -t $REPO_URL:$TAG \
        ../docker/${each.key}

      echo ":: Image pushed as $REPO_URL:$TAG"
    EOT
  }

  depends_on = [module.ecr]
}
