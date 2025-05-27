terraform {
  backend "s3" {
    bucket = "bsc.sandbox.terraform.state"
    key    = "voice_clone/terraform.tfstate"
    region = "us-east-2"

    use_lockfile = true
  }
}
