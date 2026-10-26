provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Owners      = "Todd"
      Project     = "voice_clone"
      Provisioner = "Terraform"
    }
  }
}

terraform {
  required_version = ">= 1.16.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.66"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.3"
    }
  }
}
