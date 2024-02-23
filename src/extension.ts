import * as vscode from "vscode";
import * as fs from "fs";

let sidebarView: vscode.WebviewView;

function spawnCommand(
  command: string,
  args: string[],
  success: { (arg0: string[]): void },
  failure: { (arg0: string[]): void }
) {
  const { spawn } = require("child_process");
  const cmd = spawn(command, args, {
    cwd: `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}`,
  });
  // Listen for any response from the command
  let output: string[] = [""];

  cmd.stderr.on("data", (data: any) => {
    process.stdout.write(`${data}`);
    output.push(data);
  });

  cmd.stdout.on("data", (data: any) => {
    process.stdout.write(`${data}`);
    output.push(data);
  });

  // Listen for the exit event
  cmd.on("exit", (code: number) => {
    if (code === 0) {
      success(output);
    } else {
      failure(output);
    }
  });
}

function resetCanisterList(): Thenable<boolean> {
  return sidebarView.webview.postMessage({ type: "deactivate" });
}

function startServer() {
  spawnCommand(
    "dfx",
    ["start", "--background", "--clean"],
    (output) => {
      vscode.window.showInformationMessage("Server started.");
      vscode.window.showInformationMessage(`${output.at(-1)}`);
    },
    (output) => {
      vscode.window.showErrorMessage(output.flat().join(""));
    }
  );
}

function stopServer() {
  spawnCommand(
    "dfx",
    ["stop"],
    () => {
      vscode.window.showInformationMessage("Server stopped.");
    },
    (output) => {
      vscode.window.showErrorMessage(output.flat().join(""));
    }
  );
  resetCanisterList();
}

function publishCanisters() {
  // ✅ dfx identity new vscode-ext --storage-mode plaintext
  // ✅ dfx identity use vscode-ext
  spawnCommand(
    "dfx",
    ["ledger", "account-id"],
    (output) => {
      const account = output.flat().join("");
      const message = { type: "showQRCode", value: account };
      sidebarView.webview.postMessage(message);
      vscode.window.showInformationMessage(`Account ID: ${account}`);
    },
    (output) => {
      vscode.window.showErrorMessage(output.flat().join(""));
    }
  );

  // show balance: dfx ledger balance --network ic

  // dfx ledger account-id
  // show qr code, request user to send X ICP to the account
  // dfx quickstart
  // dfx identity export vscode-ext > identity.pem
}

function deployCanisters() {
  vscode.window.showInformationMessage("Deploying canisters...");
  spawnCommand(
    "dfx",
    ["deploy"],
    () => {
      const file = `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/.dfx/local/canister_ids.json`;
      fs.readFile(file, "utf8", (err: any, data: any) => {
        if (err) {
          vscode.window.showErrorMessage(err);
          return;
        }
        const canisters = JSON.parse(data);
        const message = {
          type: "updateCanisterList",
          value: canisters,
        };
        sidebarView.webview.postMessage(message);
      });
      vscode.window.showInformationMessage("Deployed canisters!");
    },
    (output) => {
      vscode.window.showErrorMessage(output.flat().join(""));
    }
  );
}

class MainViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "base-view-sidebar";
  constructor(private readonly _extensionUri: vscode.Uri) {}
  public resolveWebviewView(
    view: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    sidebarView = view;
    view.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    view.webview.html = this._getHtmlForWebview(view.webview);

    // UI => extension
    view.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "dfxStart": {
          startServer();
          break;
        }
        case "dfxStop": {
          stopServer();
          break;
        }
        case "dfxDeploy": {
          deployCanisters();
          break;
        }
        case "publishCanisters": {
          publishCanisters();
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const getUri = (...pathSegments: string[]) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, ...pathSegments)
      );

    const stylesUri = getUri("webview-ui", "build", "assets", "index.css");
    const scriptUri = getUri("webview-ui", "build", "assets", "index.js");

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link href="${stylesUri}" rel="stylesheet">
		<title>ICP Developer Extension</title>
	</head>
	<body>
		<div id="root"></div>
		<script type="module" nonce="${nonce}" src="${scriptUri}"></script>
	</body>
	</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function load_extension(context: vscode.ExtensionContext) {
  const provider = new MainViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MainViewProvider.viewType,
      provider
    )
  );

  // Add an icon to the activity bar
  const startServerIcon = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  startServerIcon.text = "$(play)";
  startServerIcon.tooltip = "Deploy Canisters";
  startServerIcon.command = "extension.dfxDeploy";
  startServerIcon.show();

  // Register the command to start the server
  let disposableStart = vscode.commands.registerCommand(
    "extension.startServer",
    startServer
  );

  // Register the command to stop the server
  let disposableStop = vscode.commands.registerCommand(
    "extension.stopServer",
    stopServer
  );

  // Register the command to deploy canisters
  let dfxDeploy = vscode.commands.registerCommand(
    "extension.dfxDeploy",
    deployCanisters
  );

  let publish = vscode.commands.registerCommand(
    "extension.publishCanisters",
    publishCanisters
  );

  // Add a disposable to dispose the subscriptions when the extension is deactivated
  context.subscriptions.push(
    startServerIcon,
    disposableStart,
    disposableStop,
    dfxDeploy,
    publish
  );

  // Start the server, create an identity and set it.
  spawnCommand(
    "dfx",
    ["start", "--background", "--clean"],
    (output) => {
      vscode.window.showInformationMessage("Server started.");
      vscode.window.showInformationMessage(`${output.at(-1)}`);
      spawnCommand(
        "dfx",
        ["identity", "new", "vscode-ext", "--storage-mode", "plaintext"],
        () => {
          vscode.window.showInformationMessage("Identity created.");
          spawnCommand(
            "dfx",
            ["identity", "use", "vscode-ext"],
            () => {
              vscode.window.showInformationMessage("Identity set.");
            },
            (output) => {
              vscode.window.showErrorMessage(output.flat().join(""));
            }
          );
        },
        (output) => {
          vscode.window.showErrorMessage(output.flat().join(""));
        }
      );
    },
    (output) => {
      vscode.window.showErrorMessage(output.flat().join(""));
    }
  );
}

export function activate(context: vscode.ExtensionContext) {
  // Check if there's a dfx.json file in the workspace
  spawnCommand(
    "find",
    ["dfx.json"],
    () => {
      load_extension(context);
    },
    () =>
      vscode.window.showErrorMessage("No dfx.json file found in the workspace.")
  );
}

export function deactivate() {
  // This method is called when the extension is deactivated
  // FIXME: This message never reaches the webview, probably gets killed too early
  resetCanisterList().then(() =>
    console.log("Successfully reset canister list.")
  );
}
