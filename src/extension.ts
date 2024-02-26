import * as vscode from 'vscode';
import * as fs from 'fs';
import execa from 'execa';

let sidebarView: vscode.WebviewView;
const execOptions = {
    cwd: `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}`,
};

function resetCanisterList(): Thenable<boolean> {
    return sidebarView.webview.postMessage({ type: 'deactivate' });
}

function startServer() {
    try {
        const cmd = execa(
            'dfx',
            ['start', '--background', '--clean'],
            execOptions
        );

        cmd.stderr?.on('data', (data: any) => {
            process.stdout.write(`${data}`);
        });

        cmd.on('exit', (code: any) => {
            vscode.window.showInformationMessage('Server started.');
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function stopServer() {
    try {
        const cmd = await execa('dfx', ['stop'], execOptions);
        process.stdout.write(`${cmd.stderr}`);
        process.stdout.write(cmd.stdout);
        vscode.window.showInformationMessage('Server stopped.');
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
    resetCanisterList();
}

async function publishCanisters() {
    // ✅ dfx identity new vscode-ext --storage-mode plaintext
    // ✅ dfx identity use vscode-ext
    try {
        const cmd = await execa(
            'dfx',
            ['ledger', 'account-id', '--network', 'ic'],
            execOptions
        );
        const accountId = cmd.stdout;
        const message = { type: 'showQRCode', value: accountId };
        sidebarView.webview.postMessage(message);
        console.log(cmd.stdout);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }

    // show balance: dfx ledger balance --network ic

    // dfx ledger account-id
    // show qr code, request user to send X ICP to the account
    // dfx quickstart
    // dfx identity export vscode-ext > identity.pem
}

async function balance() {
    try {
        const cmd = await execa(
            'dfx',
            ['ledger', 'balance', '--network', 'ic'],
            execOptions
        );
        const balance: number = parseFloat(cmd.stdout.split(' ')[0]);
        const message = { type: 'balance', value: balance };
        sidebarView.webview.postMessage(message);
        console.log(cmd.stdout);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function deployCanisters() {
    vscode.window.showInformationMessage('Deploying canisters...');
    try {
        const cmd = execa('dfx', ['deploy'], execOptions);

        cmd.stderr?.on('data', (data: any) => {
            process.stdout.write(`${data}`);
        });
        await cmd;

        const file = `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/.dfx/local/canister_ids.json`;
        fs.readFile(file, 'utf8', (err: any, data: any) => {
            if (err) {
                vscode.window.showErrorMessage(err);
                return;
            }
            const canisters = JSON.parse(data);
            const message = {
                type: 'updateCanisterList',
                value: canisters,
            };
            sidebarView.webview.postMessage(message);
        });
        vscode.window.showInformationMessage('Deployed canisters!');
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function createIdentity() {
    try {
        const cmd = await execa(
            'dfx',
            ['identity', 'new', 'vscode-ext', '--storage-mode', 'plaintext'],
            execOptions
        );
        vscode.window.showInformationMessage('Identity created.');
        console.log(cmd.stderr);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function useIdentity() {
    try {
        const cmd = await execa(
            'dfx',
            ['identity', 'use', 'vscode-ext'],
            execOptions
        );
        vscode.window.showInformationMessage('Identity set.');
        console.log(cmd.stderr);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

class MainViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'base-view-sidebar';
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
                case 'dfxStart': {
                    startServer();
                    break;
                }
                case 'dfxStop': {
                    stopServer();
                    break;
                }
                case 'dfxDeploy': {
                    deployCanisters();
                    break;
                }
                case 'publishCanisters': {
                    publishCanisters();
                    break;
                }
                case 'balance': {
                    balance();
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

        const stylesUri = getUri('webview-ui', 'build', 'assets', 'index.css');
        const scriptUri = getUri('webview-ui', 'build', 'assets', 'index.js');

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
    let text = '';
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function load_extension(context: vscode.ExtensionContext) {
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
    startServerIcon.text = '$(play)';
    startServerIcon.tooltip = 'Deploy Canisters';
    startServerIcon.command = 'extension.dfxDeploy';
    startServerIcon.show();

    // Register the command to start the server
    let disposableStart = vscode.commands.registerCommand(
        'extension.startServer',
        startServer
    );

    // Register the command to stop the server
    let disposableStop = vscode.commands.registerCommand(
        'extension.stopServer',
        stopServer
    );

    // Register the command to deploy canisters
    let dfxDeploy = vscode.commands.registerCommand(
        'extension.dfxDeploy',
        deployCanisters
    );

    let publish = vscode.commands.registerCommand(
        'extension.publishCanisters',
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

    await createIdentity();
    await useIdentity();
    startServer();
}

export async function activate(context: vscode.ExtensionContext) {
    // Check if there's a dfx.json file in the workspace
    try {
        await execa('find', ['dfx.json'], execOptions);
        load_extension(context);
    } catch (error: any) {
        vscode.window.showErrorMessage(
            'No dfx.json file found in the workspace.'
        );
    }
}

export function deactivate() {
    // This method is called when the extension is deactivated
    // FIXME: This message never reaches the webview, probably gets killed too early
    resetCanisterList().then(() =>
        console.log('Successfully reset canister list.')
    );
}
