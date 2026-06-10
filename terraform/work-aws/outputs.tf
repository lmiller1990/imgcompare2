output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  value = aws_instance.app.public_ip
}

output "url" {
  value = "https://${var.subdomain}.${var.domain_name}"
}

output "s3_bucket" {
  value = aws_s3_bucket.screenshots.bucket
}
