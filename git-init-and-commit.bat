@echo off
cd /d "%~dp0"
REM Use attrib to clear read-only so Git can write to .git/objects
attrib -R .git\* /s /d
attrib -R .git /d
REM Ensure HEAD exists so repo is valid
if not exist .git\HEAD (
  echo ref: refs/heads/main > .git\HEAD
)
git add -A
git status
git commit -m "Initial commit: Resume Tailor - template merge, PDF render, placeholder fixes"
echo Done.
if "%1"=="" pause
