output "account_number" {
  value = data.aws_caller_identity.this.account_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "public_domain" {
  value = var.domain
}

output "public_domain_id" {
  value = data.aws_route53_zone.public.zone_id
}

output "s3_bucket_name" {
  value = module.s3_bucket_eks.s3_bucket_id
}
