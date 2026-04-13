#pragma warning disable PSUseDeclaredVarsMoreThanAssignments
$ErrorActionPreference = "Stop"

$uvicornArgs = @(
	"app.main:app"
	"--host"
	"0.0.0.0"
	"--port"
	"8020"
	"--reload"
)

& uvicorn @uvicornArgs
#pragma warning restore PSUseDeclaredVarsMoreThanAssignments
