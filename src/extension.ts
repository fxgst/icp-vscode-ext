import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';

let view: vscode.WebviewView;

function spawnCommand(command: string, args: string[], success: { (arg0: string[]): void; }, failure: { (arg0: string[]): void; }) {
	const cmd = spawn(command, args, { cwd: `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}` });
	// Listen for any response from the command
	let output: string[] = [''];

	cmd.stderr.on('data', (data: any) => {
		process.stdout.write(`${data}`);
		output.push(data);
	});

	cmd.stdout.on('data', (data: any) => {
		process.stdout.write(`${data}`);
		output.push(data);
	});

	// Listen for the exit event
	cmd.on('exit', (code: number) => {
		if (code === 0) {
			success(output);
		} else {
			failure(output);
		}
	});
}

function startServer() {
	spawnCommand('dfx', ['start', '--background', '--clean'], (output) => {
		vscode.window.showInformationMessage('Server started.');
		vscode.window.showInformationMessage(`${output.at(-1)}`);
	}, (output) => { vscode.window.showErrorMessage(output.flat().join('')); });
}

function stopServer() {
	spawnCommand('dfx', ['stop'], () => {
		vscode.window.showInformationMessage('Server stopped.');
	}, (output) => { vscode.window.showErrorMessage(output.flat().join('')); });

}

function deployCanisters() {
	vscode.window.showInformationMessage('Deploying canisters...');
	spawnCommand('dfx', ['deploy'], (output) => {
		// const urls_start = output.findIndex((line: string) => line.includes('URLs:'));
		// let urls = `${output.at(urls_start) ?? ''} ${output.at(urls_start + 1) ?? ''}`;
		const fs = require('node:fs');
		fs.readFile(`${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/.dfx/local/canister_ids.json`, 'utf8', (err: any, data: any) => {
			if (err) {
				vscode.window.showErrorMessage(err);
				return;
			}
			const canisters = JSON.parse(data);
			const message = {
				type: 'updateCanisterList', value: canisters
			};
			view.webview.postMessage(message);
		}
		);
		vscode.window.showInformationMessage("Deployed canisters!");

	}, (output) => {
		vscode.window.showErrorMessage(output.flat().join(''));
	});
}

class MainViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'base-view-sidebar';

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// UI => vscode command
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'dfxStart':
					{
						startServer();
						break;
					}
				case 'dfxStop':
					{
						stopServer();
						break;
					}
				case 'dfxDeploy':
					{
						deployCanisters();
						break;
					}
			}
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
				<html lang="en">
				<head>
				<meta charset="UTF-8">
				
				<!--
				Use a content security policy to only allow loading styles from our extension directory,
				and only allow scripts that have a specific nonce.
				(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				
				<title>ICP Developer Extension</title>
				</head>
				<body>
				
				<h2>IC Server</h2>
				<button class="dfx-start-button">Start Server</button>
				<button class="dfx-stop-button">Stop Server</button>
				
				<h2>Develop</h2>
				
				<button class="dfx-deploy-button">Deploy Canisters</button>
				<button class="dfx-deploy-button">Publish Canisters on ICP</button>
				
				<h2>Canisters</h2>
				
				<div class="canister-links">
				
				</div>
				
				<script nonce="${nonce}" src="${scriptUri}"></script>
				</body>
				</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

function load_extension(context: vscode.ExtensionContext) {
	const provider = new MainViewProvider(context.extensionUri);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(MainViewProvider.viewType, provider));

	// Add an icon to the activity bar
	const startServerIcon = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	startServerIcon.text = '$(play)';
	startServerIcon.tooltip = 'Deploy Canisters';
	startServerIcon.command = 'extension.dfxDeploy';
	startServerIcon.show();

	// Register the command to start the server
	let disposableStart = vscode.commands.registerCommand('extension.startServer', startServer);

	// Register the command to stop the server
	let disposableStop = vscode.commands.registerCommand('extension.stopServer', stopServer);

	// Register the command to deploy canisters
	let dfxDeploy = vscode.commands.registerCommand('extension.dfxDeploy', deployCanisters);

	// Add a disposable to dispose the subscriptions when the extension is deactivated
	context.subscriptions.push(startServerIcon, disposableStart, disposableStop, dfxDeploy);
}


export function activate(context: vscode.ExtensionContext) {
	spawnCommand('find', ['dfx.json'], () => { load_extension(context); }, () => vscode.window.showErrorMessage('No dfx.json file found in the workspace.'));
}

export function deactivate() {
	// This method is called when the extension is deactivated
	stopServer();
}
