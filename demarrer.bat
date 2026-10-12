@echo off
rem Robot Rush : lancement en mode local sur le PC du professeur (double-clic).
chcp 65001 >nul
title Robot Rush
cd /d "%~dp0"

rem 1. Node.js : version portable dans le dossier "node", sinon celle installee sur le PC.
set "NODE=node"
set "NPM=npm"
if exist "%~dp0node\node.exe" (
  set "NODE=%~dp0node\node.exe"
  set "NPM=%~dp0node\npm.cmd"
)
"%NODE%" --version >nul 2>&1
if errorlevel 1 goto sans_node

rem Version 18 ou plus.
"%NODE%" -e "process.exit(Number(process.versions.node.split('.')[0]) < 18 ? 1 : 0)"
if errorlevel 1 goto node_ancien

rem 2. Fichier de configuration (port, mot de passe) : cree au premier lancement.
if not exist "%~dp0config-serveur.json" copy "%~dp0config-serveur.exemple.json" "%~dp0config-serveur.json" >nul

rem 3. Composants : installes une seule fois (connexion internet necessaire cette fois-la).
if not exist "%~dp0node_modules\express\package.json" goto installer
:lancer
set "OUVRIR_NAVIGATEUR=1"
"%NODE%" "%~dp0server\index.js"
echo.
echo  Robot Rush s'est arrêté. Vous pouvez fermer cette fenêtre.
pause
exit /b 0

:installer
echo.
echo  Première utilisation : installation des composants de Robot Rush...
echo  Une connexion internet est nécessaire pour cette étape uniquement.
echo.
call "%NPM%" install --omit=dev --no-audit --no-fund
if errorlevel 1 goto echec_installation
goto lancer

:sans_node
echo.
echo  ============================================================
echo   Node.js n'est pas installé sur ce PC.
echo  ============================================================
echo.
echo   Robot Rush a besoin de Node.js pour fonctionner.
echo.
echo   Solution 1 : installer Node.js, version LTS, depuis
echo                https://nodejs.org/fr/download
echo                puis double-cliquer de nouveau sur demarrer.bat.
echo.
echo   Solution 2, sans droits d'administrateur : version portable.
echo                Voir le fichier MODE-LOCAL.md, étape 1.
echo.
pause
exit /b 1

:node_ancien
echo.
echo  La version de Node.js de ce PC est trop ancienne.
"%NODE%" --version
echo  Installez la version LTS depuis https://nodejs.org/fr/download
echo.
pause
exit /b 1

:echec_installation
echo.
echo  L'installation des composants a échoué.
echo  Vérifiez la connexion internet de ce PC, puis relancez demarrer.bat.
echo  Autre solution : copier le dossier Robot Rush complet, avec son dossier
echo  node_modules, depuis un PC où le jeu fonctionne déjà.
echo.
pause
exit /b 1
