@echo off
setlocal

echo Sims 4 Mod Manager start options
echo.
echo Here you can specify start options that can help with finding problems with the Mod Manager. Enter the desired values and confirm your entries with the Enter key.
echo __________________________________________________________
echo.

REM Ask for the number of threads
set /p threadCount=How many threads is the program allowed to use? (Leave empty for default): 

REM Ask if workers should be visible
set /p showWorker=Should workers be visible? (y/n, default is n): 

REM Ask for in-depth information log
set /p extraLog=Would you like to log in-depth information? (y/n, default is n): 

REM Ask if store log files
set /p noLogFile=Should logs NOT be saved as a file? (y/n, default is n): 

REM Ask if hardware acceleration should be disabled
set /p disableHardwareAcceleration=Should hardware acceleration be disabled? (y/n, default is n): 

REM Construct the command
set command="GameTimeDev's Sims 4 Mod Manager.exe"

if not "%threadCount%"=="" (
    set command=%command% --threadCount %threadCount%
)

if /i "%showWorker%"=="y" (
    set command=%command% --showWorker
)

if /i "%extraLog%"=="y" (
    set command=%command% --extraLog
)

if /i "%noLogFile%"=="y" (
    set command=%command% --noLogFile
)

if /i "%disableHardwareAcceleration%"=="y" (
    set command=%command% --disableHardwareAcceleration
)


REM Execute the command
echo %command%
%command%

endlocal
pause
