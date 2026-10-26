locals {
  domain_name = "${local.environment}.${var.domain}"

  cloudfront_cache_disabled_policy_id            = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  cloudfront_origin_request_all_viewer_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"

  api_path_patterns = [
    {
      allowed_methods = ["GET", "HEAD", "OPTIONS", "POST"]
      path_pattern    = "input"
      query_string    = true
    },
    {
      allowed_methods = ["GET", "HEAD", "OPTIONS"]
      path_pattern    = "outputs"
      query_string    = true
    },
    {
      allowed_methods = ["GET", "HEAD", "OPTIONS"]
      path_pattern    = "outputs/*"
      query_string    = false
    },
    {
      allowed_methods = ["GET", "HEAD", "OPTIONS", "POST"]
      path_pattern    = "synthesize"
      query_string    = true
    },
  ]

  api_cache_behaviors = [
    for pattern in local.api_path_patterns : {
      allowed_methods          = pattern.allowed_methods
      cache_policy_id          = local.cloudfront_cache_disabled_policy_id
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      origin_request_policy_id = local.cloudfront_origin_request_all_viewer_except_host
      path_pattern             = pattern.path_pattern
      query_string             = pattern.query_string
      target_origin_id         = "api_gw"
      viewer_protocol_policy   = "redirect-to-https"
    }
  ]
}

data "aws_route53_zone" "public" {
  name         = var.domain
  private_zone = false
}

module "cdn" {
  source  = "terraform-aws-modules/cloudfront/aws"
  version = "~> 5.2.0"

  aliases             = [local.domain_name]
  comment             = "${local.domain_name} Site CDN"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  retain_on_delete    = false
  wait_for_deployment = false

  default_root_object = "index.html"

  create_origin_access_control = true
  origin_access_control = {
    (local.domain_name) = {
      description      = "${local.domain_name} CloudFront access to S3"
      origin_type      = "s3"
      signing_behavior = "always"
      signing_protocol = "sigv4"
    }
  }

  origin = {
    s3_primary = {
      domain_name           = module.site_s3_bucket.s3_bucket_bucket_domain_name
      origin_access_control = local.domain_name
    }

    api_gw = {
      domain_name = replace(module.api_gateway.api_endpoint, "/^https?://([^/]*).*/", "$1")
      origin_custom_headers = {
        Host = local.domain_name
      }
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "match-viewer"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  default_cache_behavior = {
    target_origin_id       = "s3_primary"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]
    compress        = true
    query_string    = true
  }

  ordered_cache_behavior = concat(
    local.api_cache_behaviors,
    [
      {
        allowed_methods        = ["GET", "HEAD", "OPTIONS"]
        cached_methods         = ["GET", "HEAD"]
        compress               = true
        path_pattern           = "*"
        query_string           = true
        target_origin_id       = "s3_primary"
        viewer_protocol_policy = "redirect-to-https"
      },
    ],
  )

  custom_error_response = [
    {
      error_code         = 403
      response_code      = 200
      response_page_path = "/index.html"
    },
    {
      error_code         = 404
      response_code      = 200
      response_page_path = "/index.html"
    },
  ]

  viewer_certificate = {
    acm_certificate_arn = aws_acm_certificate.this.arn
    ssl_support_method  = "sni-only"
  }

  tags = var.tags
}

resource "aws_acm_certificate" "this" {
  domain_name       = local.domain_name
  validation_method = "DNS"

  tags = merge(var.tags,
    {
      Name = local.domain_name
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "site" {
  zone_id = data.aws_route53_zone.public.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = module.cdn.cloudfront_distribution_domain_name
    zone_id                = module.cdn.cloudfront_distribution_hosted_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "verify" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.public.zone_id
}
