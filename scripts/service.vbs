' Launches the usage-collector production server with NO visible console window.
' Portable: resolves its own folder, so it works from any clone location.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run """" & scriptDir & "\serve.cmd""", 0, False
