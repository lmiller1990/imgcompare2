variable "aws_region" {
  default = "ap-southeast-2"
}

variable "load_balancer_name" {
  description = "Name of the existing shared ALB"
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB (for EC2 ingress rule)"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  default     = "Z03100692ZZNL51X8CFNF"
}

variable "name" {
  default = "imgcompare"
}

variable "domain_name" {
  default = "dev.microba.com"
}

variable "subdomain" {
  default = "imgcompare"
}

variable "listener_rule_priority" {
  description = "Priority for ALB listener rules — must not clash with other rules"
  type        = number
}

variable "instance_type" {
  default = "t3.small"
}

variable "key_name" {
  description = "EC2 key pair name for SSH access"
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed SSH access to the EC2 instance"
  type        = list(string)
}

variable "master_key" {
  description = "32-byte base64-encoded master key (openssl rand -base64 32)"
  sensitive   = true
}
