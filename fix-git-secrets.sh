#!/bin/bash

# Fix Git Secret Scanning Issues
# This script removes sensitive files from git history

echo "🔒 Fixing Git Secret Scanning Issues"
echo "======================================"
echo ""

# Files containing secrets (already deleted but in history)
FILES_TO_REMOVE=(
  "CATALOG_API_403_DETAILED_ANALYSIS.md"
  "CATALOG_API_FINAL_ANALYSIS.md"
  "REGENERATE_REFRESH_TOKEN_GUIDE.md"
)

echo "Files to remove from git history:"
for file in "${FILES_TO_REMOVE[@]}"; do
  echo "  - $file"
done
echo ""

# Option 1: Use git filter-repo (recommended)
echo "Option 1: Remove files from history using git filter-repo"
echo "-----------------------------------------------------------"
echo "Install git filter-repo:"
echo "  brew install git-filter-repo"
echo ""
echo "Then run:"
for file in "${FILES_TO_REMOVE[@]}"; do
  echo "  git filter-repo --invert-paths --path $file"
done
echo ""
echo "After filtering, force push:"
echo "  git push origin main --force"
echo ""

# Option 2: Use BFG Repo-Cleaner
echo "Option 2: Use BFG Repo-Cleaner"
echo "-------------------------------"
echo "Install BFG:"
echo "  brew install bfg"
echo ""
echo "Create files list:"
echo "  cat > files-to-delete.txt << EOF"
for file in "${FILES_TO_REMOVE[@]}"; do
  echo "$file"
done
echo "EOF"
echo ""
echo "Run BFG:"
echo "  bfg --delete-files files-to-delete.txt"
echo "  git reflog expire --expire=now --all && git gc --prune=now --aggressive"
echo "  git push origin main --force"
echo ""

# Option 3: GitHub Allow Secret (easiest)
echo "Option 3: Allow secret in GitHub (EASIEST)"
echo "-------------------------------------------"
echo "Click this URL to allow the secrets:"
echo "  https://github.com/FridaySalami/pre-prod/security/secret-scanning/unblock-secret/340lW40VWKuHXjDmQ2Gr4hW6GCf"
echo "  https://github.com/FridaySalami/pre-prod/security/secret-scanning/unblock-secret/340lW8kvJFLMTv18aes0eueBggm"
echo ""
echo "Then push again:"
echo "  git push origin main"
echo ""

# Option 4: Create new branch (nuclear option)
echo "Option 4: Start fresh with new branch (NUCLEAR OPTION)"
echo "--------------------------------------------------------"
echo "This keeps your current work but starts a clean history:"
echo ""
echo "  # Create orphan branch (no history)"
echo "  git checkout --orphan clean-main"
echo "  git add -A"
echo "  git commit -m 'feat: clean repository without secrets'"
echo "  git branch -D main"
echo "  git branch -m main"
echo "  git push origin main --force"
echo ""

echo "======================================"
echo "⚠️  RECOMMENDATION: Use Option 3 (Allow secret in GitHub)"
echo "This is the fastest solution since the files are already deleted."
echo "======================================"
