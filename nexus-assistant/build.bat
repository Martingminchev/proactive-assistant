@echo off
echo Building NEXUS...

:: Clean dist folder
if exist dist rmdir /s /q dist

:: Create dist folders
mkdir dist\main
mkdir dist\renderer

:: Compile TypeScript main process
.\node_modules\.bin\tsc.cmd -p tsconfig.main.json

:: Build renderer with Vite  
.\node_modules\.bin\vite.cmd build

echo Build complete!
pause
