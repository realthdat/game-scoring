@echo off
title Game Scoring - Launcher
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0run-app.ps1"
pause
