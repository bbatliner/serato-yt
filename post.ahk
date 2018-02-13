Sleep 1700
WinGetPos, origX, origY, origWidth, origHeight, A
SysGet, Mon, Monitor
WinMove, A,, MonRight / 2, 0, MonRight / 2, MonBottom
Sleep 10
Send {F2}
Sleep 10
x := A_CaretX
y := A_CaretY
Send {ESC}
Sleep 10
MouseMove, x, y, 0
CoordMode, Mouse, Screen
MouseClickDrag, Left,,, A_Args[1], A_Args[2], 0
Sleep 50
WinMove, A,, origX, origY, origWidth, origHeight
Sleep 10
Send !{F4}
