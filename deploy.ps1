<#
PowerShell deploy script
Usage:
  1. Authenticate: `gh auth login` and `vercel login`
  2. From project root run: `.
un\deploy.ps1` or `./deploy.ps1` in PowerShell

What it does:
  - Initializes git (if needed), commits changes
  - Creates or pushes to GitHub repo `Abhinandan1pandey/New-Url-shortner`
  - Installs node deps, builds Vite app (`npm run build`)
  - Calls `vercel --prod` to deploy

Note: This script assumes GitHub CLI (`gh`) and Vercel CLI (`vercel`) are installed and authenticated.
#>

param(
  [string]$Repo = 'Abhinandan1pandey/New-Url-shortner'
)

function Fail($msg){ Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail "GitHub CLI 'gh' not found. Install and run 'gh auth login'." }
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) { Fail "Vercel CLI 'vercel' not found. Install and run 'vercel login'." }

Write-Host "Initializing git (if needed)..."
if (-not (Test-Path .git)) { git init }

Write-Host "Staging changes..."
git add .

try { git commit -m "Prepare for deploy — Url Shortner System" -q } catch { Write-Host "No changes to commit or commit failed." }

Write-Host "Ensuring remote repo exists on GitHub: $Repo"
try {
  gh repo create $Repo --public --source=. --remote=origin --push
} catch {
  Write-Host "Repository may already exist; setting remote and pushing..."
  git remote remove origin 2>$null
  git remote add origin "https://github.com/$Repo.git"
  git branch -M main
  git push -u origin main
}

Write-Host "Installing Node dependencies..."
npm install

Write-Host "Building frontend..."
npm run build

Write-Host "Deploying to Vercel (production)..."
vercel --prod --confirm

Write-Host "Done. Check Vercel output above for the live URL." -ForegroundColor Green
