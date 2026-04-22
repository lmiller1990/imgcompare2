provider "aws" {
  region  = "ap-southeast-2"
  profile = "terraform"
}

data "aws_caller_identity" "current" {}

############################
# S3 Bucket
############################

resource "aws_s3_bucket" "screenshots" {
  bucket = "lcm-au-imgcompare-screenshots"
}

resource "aws_s3_bucket_versioning" "screenshots" {
  bucket = aws_s3_bucket.screenshots.id

  versioning_configuration {
    status = "Enabled"
  }
}

############################
# IAM Role
############################

resource "aws_iam_role" "imgcompare" {
  name = "imgcompare"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::058664348318:user/terraform",
            aws_iam_user.home_server.arn
          ]
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

############################
# IAM User (home server)
############################

# Long-lived access keys for this user should be created outside Terraform,
# otherwise the secret ends up in Terraform state.
resource "aws_iam_user" "home_server" {
  name = "home-server"
}

resource "aws_iam_policy" "home_server_assume_imgcompare" {
  name = "home-server-assume-imgcompare"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sts:AssumeRole"
        ]
        Resource = [
          aws_iam_role.imgcompare.arn
        ]
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "home_server_assume_imgcompare" {
  user       = aws_iam_user.home_server.name
  policy_arn = aws_iam_policy.home_server_assume_imgcompare.arn
}

############################
# IAM Policy (S3 access)
############################

resource "aws_iam_policy" "imgcompare_s3" {
  name = "imgcompare-s3-access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.screenshots.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:CreateBucket",
          "s3:HeadBucket"
        ]
        Resource = [
          "${aws_s3_bucket.screenshots.arn}/*"
        ]
      }
    ]
  })
}

############################
# Attach policy to role
############################

resource "aws_iam_role_policy_attachment" "attach" {
  role       = aws_iam_role.imgcompare.name
  policy_arn = aws_iam_policy.imgcompare_s3.arn
}
