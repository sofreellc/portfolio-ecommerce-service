#!/bin/bash

# Script to install dependencies for all Lambda functions
echo "Installing dependencies for Lambda functions..."

# Find all package.json files in lambda directory (excluding node_modules)
find lambda -type f -name package.json -not -path "*/node_modules/*" | while read package_json; do
  lambda_dir=$(dirname "$package_json")
  echo "Installing dependencies for $lambda_dir"
  (cd "$lambda_dir" && yarn install --frozen-lockfile)
done

echo "Lambda dependencies installation completed!"