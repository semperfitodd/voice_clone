domain = "brewsentry.com"

ecr_repos = {
  tortoise = "tortoise"
}

eks_cluster_version = "1.32"

eks_node_instance_type = "t3.medium"

eks_node_gpu_instance_type = "g4dn.xlarge"

environment = "voice_clone"

internal_lb_name_tortoise = "tortoise/voice-generator-ingress"

region = "us-east-1"

vpc_cidr = "10.11.0.0/16"
