locals {
  node_group_name = "${var.environment}_node_group"

  node_group_name_gpu = "${var.environment}_gpu"
}

data "aws_iam_policy" "AmazonSSMManagedInstanceCore" {
  name = "AmazonSSMManagedInstanceCore"
}

module "ebs_csi_irsa_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name             = "${var.environment}_ebs_csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.36.0"

  cluster_name = local.environment

  authentication_mode             = "API_AND_CONFIG_MAP"
  cluster_version                 = var.eks_cluster_version
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true

  cluster_ip_family = "ipv4"

  cluster_addons = {
    aws-ebs-csi-driver = {
      service_account_role_arn = module.ebs_csi_irsa_role.iam_role_arn
      most_recent              = true
    }
    aws-mountpoint-s3-csi-driver = {
      service_account_role_arn = module.s3_csi_irsa_role.iam_role_arn
      most_recent              = true
    }
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent    = true
      before_compute = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET       = "1"
        }
      })
    }
  }

  iam_role_additional_policies = {
    AmazonEC2ContainerRegistryReadOnly = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  }

  enable_cluster_creator_admin_permissions = true

  cluster_tags = var.tags

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    (local.node_group_name_gpu) = {
      ami_type       = "AL2_x86_64_GPU"
      instance_types = [var.eks_node_gpu_instance_type]

      min_size     = 1
      max_size     = 3
      desired_size = 1

      use_latest_ami_release_version = true

      ebs_optimized     = true
      enable_monitoring = true

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 75
            volume_type           = "gp3"
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        gpu                      = true
        "nvidia.com/gpu.present" = true
      }

      pre_bootstrap_user_data = <<-EOT
        #!/bin/bash
        set -ex

        # Install dependencies
        yum install -y cuda

        # Add the NVIDIA package repositories
        distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
        curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.repo | sudo tee /etc/yum.repos.d/nvidia-docker.repo

        # Install the NVIDIA container runtime
        sudo yum install -y nvidia-container-toolkit
      EOT
    }

    (local.node_group_name) = {
      ami_type       = "AL2_x86_64"
      instance_types = [var.eks_node_instance_type]

      min_size     = 1
      max_size     = 5
      desired_size = 1

      use_latest_ami_release_version = true

      ebs_optimized     = true
      enable_monitoring = true

      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = 75
            volume_type           = "gp3"
            encrypted             = true
            delete_on_termination = true
          }
        }
      }

      labels = {
        gpu = false
      }

      iam_role_additional_policies = {
        AmazonSSMManagedInstanceCore = data.aws_iam_policy.AmazonSSMManagedInstanceCore.arn
        eks_s3                       = aws_iam_policy.eks_s3.arn
      }

      tags = var.tags
    }
  }

  depends_on = [module.vpc.nat_ids]
}

module "s3_csi_irsa_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name                       = "${var.environment}_s3_csi"
  attach_mountpoint_s3_csi_policy = true
  mountpoint_s3_csi_bucket_arns   = [module.s3_bucket_eks.s3_bucket_arn]
  mountpoint_s3_csi_path_arns     = ["${module.s3_bucket_eks.s3_bucket_arn}/*"]

  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["cobol-ml:cobolml-s3-sa"]
    }
  }
}

module "secrets_csi_irsa_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name                      = "${var.environment}_secrets_csi"
  attach_external_secrets_policy = true

  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["cobol-ml:cobol-ml-postgres-sa"]
    }
  }
}
