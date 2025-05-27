provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "eks_cobol"
      Owners      = "Todd"
      Provisioner = "Terraform"
    }
  }
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.95.0"
    }
  }
  required_version = "1.11.4"
}