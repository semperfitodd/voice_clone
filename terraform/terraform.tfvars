domain = "brewsentry.com"

ecr_repos = {
  voice_clone = "voice_clone"
}

eks_cluster_version = "1.32"

eks_node_instance_type = "t3.medium"

eks_node_gpu_instance_type = "g4dn.xlarge"

environment = "voice_clone"

region = "us-east-1"

sagemaker_instance_type = "ml.t3.medium"

vpc_cidr = "10.11.0.0/16"
