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

output "cognito_client_id" {
  description = "Cognito app client ID for application configuration"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito custom auth domain"
  value       = "https://${local.auth_domain}"
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID for application configuration"
  value       = aws_cognito_user_pool.main.id
}
