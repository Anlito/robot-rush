@echo off
rem Robot Rush : lancement en mode local sur le PC du professeur (double-clic).
rem
rem Fichier volontairement SANS accents et SANS blocs entre parentheses : certains Windows
rem lisent mal un fichier .bat accentue, et un chemin de dossier contenant une parenthese,
rem par exemple "RobotRush (1)", casse les blocs ( ... ). La fenetre se fermait alors sans message.

rem La fenetre doit rester ouverte quoi qu'il arrive, pour que tout message reste lisible :
rem on se relance dans une invite de commandes qui ne se ferme pas toute seule (cmd /k).
if "%ROBOTRUSH_FENETRE%"=="1" goto debut
set "ROBOTRUSH_FENETRE=1"
cmd /k call "%~f0"
exit /b

:debut
chcp 65001 >nul
title Robot Rush
rem pushd (et pas cd) : fonctionne aussi quand le dossier est sur un partage reseau \\serveur\...
pushd "%~dp0"
set "DOSSIER=%CD%"

rem 0. Archive extraite ? (lance depuis l'interieur du ZIP, le dossier du jeu est absent)
if not exist "%DOSSIER%\server\index.js" goto pas_extrait

rem 1. Node.js : version portable dans le dossier "node", sinon celle installee sur le PC.
set "NODE=node"
set "NPM=npm"
set "PORTABLE=0"
if exist "%DOSSIER%\node\node.exe" set "PORTABLE=1"
if "%PORTABLE%"=="1" set "NODE=%DOSSIER%\node\node.exe"
if "%PORTABLE%"=="1" set "NPM=%DOSSIER%\node\npm.cmd"
"%NODE%" --version >nul 2>&1
if errorlevel 1 goto sans_node

rem Version 18 ou plus.
"%NODE%" -e "process.exit(Number(process.versions.node.split('.')[0]) < 18 ? 1 : 0)"
if errorlevel 1 goto node_ancien

rem 2. Fichier de configuration (port, mot de passe) : cree au premier lancement.
if not exist "%DOSSIER%\config-serveur.json" copy "%DOSSIER%\config-serveur.exemple.json" "%DOSSIER%\config-serveur.json" >nul

rem 3. Composants : installes une seule fois (connexion internet necessaire cette fois-la).
if not exist "%DOSSIER%\node_modules\express\package.json" goto installer

:lancer
set "OUVRIR_NAVIGATEUR=1"
"%NODE%" "%DOSSIER%\server\index.js"
echo.
echo  Robot Rush s'est arrete. Vous pouvez fermer cette fenetre.
goto fin

:installer
echo.
echo  Premiere utilisation : installation des composants de Robot Rush...
echo  Une connexion internet est necessaire pour cette etape uniquement.
echo.
call "%NPM%" install --omit=dev --no-audit --no-fund
if errorlevel 1 goto echec_installation
goto lancer

:pas_extrait
echo.
echo  ============================================================
echo   Le dossier Robot Rush est incomplet.
echo  ============================================================
echo.
echo   Cause la plus frequente : demarrer.bat a ete ouvert depuis
echo   l'interieur de l'archive ZIP.
echo.
echo   Faire : clic droit sur l'archive, puis "Extraire tout",
echo   puis double-cliquer sur demarrer.bat dans le dossier extrait.
echo.
echo   Dossier actuel : %DOSSIER%
goto fin

:sans_node
echo.
echo  ============================================================
if "%PORTABLE%"=="1" goto portable_bloque
echo   Node.js est introuvable.
echo  ============================================================
echo.
echo   Le dossier "node" (Node.js portable) devrait se trouver dans :
echo   %DOSSIER%
echo   Recopier le dossier Robot Rush en entier, avec son dossier "node".
echo.
echo   Ou installer Node.js, version LTS : https://nodejs.org/fr/download
goto fin

:portable_bloque
echo   Node.js est present mais n'a pas pu demarrer.
echo  ============================================================
echo.
echo   Le PC refuse sans doute de lancer des programmes copies
echo   (restriction mise en place par le service informatique).
echo.
echo   Demander au referent numerique d'autoriser ce programme :
echo   %DOSSIER%\node\node.exe
echo.
echo   Detail de l'erreur :
"%NODE%" --version
goto fin

:node_ancien
echo.
echo  La version de Node.js de ce PC est trop ancienne :
"%NODE%" --version
echo  Installer la version LTS depuis https://nodejs.org/fr/download
goto fin

:echec_installation
echo.
echo  L'installation des composants a echoue.
echo  Verifier la connexion internet de ce PC, puis relancer demarrer.bat.
echo  Autre solution : copier le dossier Robot Rush complet, avec son dossier
echo  node_modules, depuis un PC ou le jeu fonctionne deja.
goto fin

:fin
echo.
echo  (Cette fenetre reste ouverte : vous pouvez la fermer avec la croix.)
popd
exit /b
