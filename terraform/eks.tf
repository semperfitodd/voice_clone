locals {
  node_group_name = "${var.environment}_node_group"

  node_group_name_gpu = "${var.environment}_gpu"
}

data "aws_iam_policy" "AmazonSSMManagedInstanceCore" {
  name = "AmazonSSMManagedInstanceCore"
}

module "ebs_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts"
  version = "~> 6.8.2"

  attach_ebs_csi_policy = true
  name                  = "${var.environment}_ebs_csi"

  oidc_providers = {
    main = {
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
      provider_arn               = module.eks.oidc_provider_arn
    }
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.26.0"

  name               = local.environment
  kubernetes_version = var.eks_cluster_version

  enable_cluster_creator_admin_permissions = true

  endpoint_private_access = true
  endpoint_public_access  = true

  addons = {
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa_role.arn
    }
    aws-mountpoint-s3-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.s3_csi_irsa_role.arn
    }
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      before_compute = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
      most_recent = true
    }
  }

  cluster_tags = var.tags

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    (local.node_group_name_gpu) = {
      ami_type       = "AL2_x86_64_GPU"
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            delete_on_termination = true
            encrypted             = true
            volume_size           = 75
            volume_type           = "gp3"
          }
        }
      }
      capacity_type  = "SPOT"
      desired_size   = 1
      ebs_optimized  = true
      enable_monitoring = true
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = data.aws_iam_policy.AmazonSSMManagedInstanceCore.arn
        eks_s3                       = aws_iam_policy.eks_s3.arn
      }
      instance_types = var.eks_node_gpu_instance_type
      labels = {
        gpu                      = true
        "nvidia.com/gpu.present" = true
      }
      max_size = 3
      min_size = 1

      pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        set -ex

        yum install -y cuda

        distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
        curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.repo | sudo tee /etc/yum.repos.d/nvidia-docker.repo

        sudo yum install -y nvidia-container-toolkit
      EOT

      tags = var.tags
      use_latest_ami_release_version = true
    }

    (local.node_group_name) = {
      ami_type       = "AL2_x86_64"
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            delete_on_termination = true
            encrypted             = true
            volume_size           = 75
            volume_type           = "gp3"
          }
        }
      }
      capacity_type  = "SPOT"
      desired_size   = 1
      ebs_optimized  = true
      enable_monitoring = true
      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = data.aws_iam_policy.AmazonSSMManagedInstanceCore.arn
        eks_s3                       = aws_iam_policy.eks_s3.arn
      }
      instance_types = var.eks_node_instance_type
      labels = {
        gpu = false
      }
      max_size = 5
      min_size = 1
      tags     = var.tags
      use_latest_ami_release_version = true
    }
  }

  depends_on = [module.vpc.nat_ids]
}

module "s3_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts"
  version = "~> 6.8.2"

  attach_mountpoint_s3_csi_policy = true
  mountpoint_s3_csi_bucket_arns   = [module.s3_bucket_eks.s3_bucket_arn]
  mountpoint_s3_csi_path_arns     = ["${module.s3_bucket_eks.s3_bucket_arn}/*"]
  name                            = "${var.environment}_s3_csi"

  oidc_providers = {
    main = {
      namespace_service_accounts = ["kube-system:s3-csi-driver-sa"]
      provider_arn               = module.eks.oidc_provider_arn
    }
  }
}

module "secrets_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts"
  version = "~> 6.8.2"

  attach_external_secrets_policy = true
  name                           = "${var.environment}_secrets_csi"

  oidc_providers = {
    main = {
      namespace_service_accounts = ["kube-system:secrets-store-csi-driver"]
      provider_arn               = module.eks.oidc_provider_arn
    }
  }
}
