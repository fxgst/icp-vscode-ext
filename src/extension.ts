import * as vscode from 'vscode';
import * as fs from 'fs';
import execa, { ExecaChildProcess } from 'execa';

let sidebarView: vscode.WebviewView;

const dfxIdentity: string = 'vscode-ext';
const cmcId: string = 'rkp4c-7iaaa-aaaaa-aaaca-cai';
const execOptions = {
    cwd: `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}`,
    env: { DFX_DISABLE_AUTO_WALLET: '1' },
};
const requiredXdrPerCanister: number = 2;

async function resetCanisterList(): Promise<boolean> {
    return sidebarView.webview.postMessage({ type: 'deactivate' });
}

let serverProcess: ExecaChildProcess<string>;

async function startServer() {
    await stopServer();
    serverProcess = execa('dfx', ['start'], execOptions);
    serverProcess.stderr?.on('data', (data: any) => {
        process.stdout.write(`${data}`);
    });
    serverProcess.catch((error) => {
        vscode.window.showErrorMessage(error.stderr);
    });
    vscode.window.showInformationMessage('Server started.');
}

async function stopServer() {
    try {
        if (serverProcess) {
            serverProcess.kill();
            vscode.window.showInformationMessage('Server stopped.');
        }
        // FIXME: When called in `deativate`, this message never reaches the webview, probably gets killed too early
        await resetCanisterList();
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr ?? error);
    }
}

async function icpBalance(): Promise<number | undefined> {
    try {
        const cmd = await execa(
            'dfx',
            ['ledger', 'balance'], //, '--ic'],
            execOptions
        );
        const balance: number = parseFloat(cmd.stdout.split(' ')[0]);
        const message = { type: 'icpBalance', value: balance };
        sidebarView.webview.postMessage(message);
        console.log(cmd.stdout);
        return balance;
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function xdrBalance(): Promise<number | undefined> {
    try {
        const cmd = await execa(
            'dfx',
            ['wallet', 'balance'], //, '--ic'],
            execOptions
        );
        const balance = cmd.stdout?.split(' ').at(0);
        const message = { type: 'xdrBalance', value: balance };
        sidebarView.webview.postMessage(message);
        return parseFloat(balance!);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function publishCanisters() {
    // ✅ dfx identity new vscode-ext --storage-mode plaintext
    // ✅ dfx identity use vscode-ext
    try {
        const cmd = await execa(
            'dfx',
            ['ledger', 'account-id'], //, '--ic'],
            execOptions
        );
        const accountId = cmd.stdout;
        const message = { type: 'showQRCode', value: accountId };
        sidebarView.webview.postMessage(message);
        console.log(cmd.stdout);
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }

    // Create wallet if it doesn't exist
    let exists = await checkIfWalletExists();
    if (!exists) {
        console.log('Wallet does not exist, creating a new one.');
        let owner = await getPrincipal();
        if (owner !== undefined) {
            // Calculate needed ICP
            let xdr_per_icp = await getExchangeRate();

            // Count number of canisters user wants to deploy
            let number_of_canisters = numberOfCanisters();

            console.log('XDR per ICP: ' + xdr_per_icp);
            let required_icp =
                (requiredXdrPerCanister * number_of_canisters + 0.1 + 0.5) /
                xdr_per_icp!;

            required_icp = Number(required_icp.toFixed(2)) + 0.01;

            let current_balance = await icpBalance();
            if (current_balance! < required_icp) {
                vscode.window.showErrorMessage(
                    `Not enough ICP. Needed: ${required_icp}, current balance: ${current_balance}`
                );
                const message = { type: 'requiredIcp', value: required_icp };
                sidebarView.webview.postMessage(message);
                return;
            } else {
                await createWallet(owner, required_icp - 0.0001);
            }
        }
    }

    let wallet = await checkIfWalletExists();

    if (!wallet) {
        vscode.window.showErrorMessage('Wallet could not be created.');
        return;
    } else {
        console.log('Wallet found.');
        console.log('Wallet balance: ' + (await xdrBalance()));
    }

    vscode.window.showInformationMessage('Deploying canisters to mainnet...');
    console.log('Deploying canisters to mainnet...');

    try {
        const cmd = execa(
            'dfx',
            ['deploy', '--with-cycles', `${requiredXdrPerCanister}T`], //, '--ic'],
            execOptions
        );

        cmd.stderr?.on('data', (data: any) => {
            process.stdout.write(`${data}`);
        });

        const finished_cmd = await cmd;

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

        if (finished_cmd.exitCode !== 0) {
            vscode.window.showErrorMessage(
                'Error deploying canisters:' + finished_cmd.stderr
            );
            console.log('Wallet balance: ' + (await xdrBalance()));
        } else {
            vscode.window.showInformationMessage('Deployed canisters!');
            console.log('Wallet balance: ' + (await xdrBalance()));
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
        console.log(error.stderr);
        console.log('Wallet balance: ' + (await xdrBalance()));
    }

    // show balance: dfx ledger balance --network ic

    // dfx ledger account-id
    // show qr code, request user to send X ICP to the account
    // dfx quickstart
    // dfx identity export vscode-ext > identity.pem
}

async function deployCanisters() {
    vscode.window.showInformationMessage('Deploying canisters...');
    try {
        const cmd = execa('dfx', ['deploy'], execOptions);

        cmd.stderr?.on('data', (data: any) => {
            process.stdout.write(`${data}`);
        });
        const finished_cmd = await cmd;

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

        if (finished_cmd.exitCode !== 0) {
            vscode.window.showErrorMessage(
                'Error deploying canisters:' + finished_cmd.stderr
            );
        } else {
            vscode.window.showInformationMessage('Deployed canisters!');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(error.stderr);
    }
}

async function createIdentity() {
    try {
        const cmd = await execa(
            'dfx',
            ['identity', 'new', dfxIdentity, '--storage-mode', 'plaintext'],
            execOptions
        );
        vscode.window.showInformationMessage(
            `New identity ${dfxIdentity} created.`
        );
        console.log(cmd.stderr);
        console.log(cmd.stdout);
    } catch (error: any) {
        console.log(error.stderr);
        console.log(error.stdout);
    }
}

async function useIdentity() {
    try {
        const cmd = await execa(
            'dfx',
            ['identity', 'use', dfxIdentity],
            execOptions
        );
        console.log(cmd.stderr);
        console.log(cmd.stdout);
    } catch (error: any) {
        console.log(error.stderr);
        console.log(error.stdout);
    }
}

async function checkIfWalletExists(): Promise<string | undefined> {
    try {
        const cmd = await execa(
            'dfx',
            ['identity', 'get-wallet'], //, '--ic'],
            execOptions
        );
        let wallet = cmd.stdout;
        console.log(wallet);
        return wallet;
    } catch (error: any) {
        console.log(error.stderr);
    }
}

async function getPrincipal(): Promise<string | undefined> {
    try {
        const cmd = await execa(
            'dfx',
            ['identity', 'get-principal'], //, '--ic'],
            execOptions
        );
        return cmd.stdout;
    } catch (error: any) {
        console.log(error.stderr);
    }
}

async function createWallet(owner: string, icp_amount: number) {
    try {
        const cmd = await execa(
            'dfx',
            ['ledger', 'create-canister', owner, '--amount', `${icp_amount}`], //, '--ic'],
            execOptions
        );
        console.log(cmd.stderr);
        console.log(cmd.stdout);
        let canister_id = cmd.stdout.split('\n').at(-1)?.split('"').at(-2);
        if (canister_id !== undefined) {
            try {
                const cmd = await execa(
                    'dfx',
                    ['identity', 'deploy-wallet', canister_id], //, '--ic'],
                    execOptions
                );
                console.log(cmd.stderr);
                console.log(cmd.stdout);
            } catch (error: any) {
                throw error;
            }
        }
    } catch (error: any) {
        console.log(error.stderr);
    }
}

async function getExchangeRate(): Promise<number | undefined> {
    // dfx canister call rkp4c-7iaaa-aaaaa-aaaca-cai get_icp_xdr_conversion_rate --query | grep xdr_permyriad_per_icp
    try {
        const cmd = await execa(
            'dfx',
            [
                'canister',
                'call',
                cmcId,
                'get_icp_xdr_conversion_rate',
                '--query',
                // '--ic',
            ],
            execOptions
        );
        // line looks like "      xdr_permyriad_per_icp = 1_234_567 : nat64;"
        let cycles_per_e8s = cmd.stdout
            .split('\n')
            .find((line: string) => line.includes('xdr_permyriad_per_icp'))
            ?.split(' ')
            .at(-3)
            ?.split('_')
            .join('');
        if (cycles_per_e8s !== undefined) {
            let xdr_per_icp = parseFloat(cycles_per_e8s) / 10000.0; // 1 ICP = ... XDR
            console.log(xdr_per_icp);
            return xdr_per_icp;
        }
    } catch (error: any) {
        console.log(error.stderr);
        console.log(error.stdout);
    }
}

function numberOfCanisters(): number {
    const file = `${vscode.workspace.workspaceFolders?.[0].uri.fsPath}/dfx.json`;
    const data = JSON.parse(
        fs.readFileSync(file, { encoding: 'utf-8', flag: 'r' })
    );
    return Object.keys(data['canisters']).length;
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
                case 'icpBalance': {
                    icpBalance();
                    break;
                }
                case 'xdrBalance': {
                    xdrBalance();
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

    // // Add an icon to the activity bar
    // const startServerIcon = vscode.window.createStatusBarItem(
    //     vscode.StatusBarAlignment.Left
    // );
    // startServerIcon.text = '$(play)';
    // startServerIcon.tooltip = 'Deploy Canisters';
    // startServerIcon.command = 'extension.dfxDeploy';
    // startServerIcon.show();

    // Add a disposable to dispose the subscriptions when the extension is deactivated
    context.subscriptions.push(
        // startServerIcon,

        // Start the dfx server
        vscode.commands.registerCommand('extension.startServer', startServer),

        // Stop the dfx server
        vscode.commands.registerCommand('extension.stopServer', stopServer),

        // Deploy canisters to local replica
        vscode.commands.registerCommand('extension.dfxDeploy', deployCanisters),

        // Deploy canisters to ICP mainnet
        vscode.commands.registerCommand(
            'extension.publishCanisters',
            publishCanisters
        )
    );

    await createIdentity();
    await useIdentity();
    await startServer();
}

export async function activate(context: vscode.ExtensionContext) {
    // Check if there's a dfx.json file in the workspace
    try {
        await execa('find', ['dfx.json'], execOptions);
        await load_extension(context);
    } catch (error: any) {
        vscode.window.showErrorMessage(
            'No dfx.json file found in the workspace.'
        );
    }
}

export async function deactivate() {
    // This method is called when the extension is deactivated
    await stopServer();
}
