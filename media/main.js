//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {

    // @ts-ignore
    const vscode = acquireVsCodeApi();

    // const oldState = vscode.getState() || { stored_value: [] };
    // /** @type {Array<{ value: string }>} */
    // let stored_value = oldState.stored_value;

    document.querySelector('.dfx-start-button')?.addEventListener('click', () => {
        dfxStart();
    });
    document.querySelector('.dfx-stop-button')?.addEventListener('click', () => {
        dfxStop();
    });
    document.querySelector('.dfx-deploy-button')?.addEventListener('click', () => {
        dfxDeploy();
    });

    // Handle messages sent from the extension to the webview
    // VSCode Command => UI
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'dfxStart':
                {
                    dfxStart();
                    break;
                }
            case 'updateCanisterList':
                {
                    updateCanisterList(message.value);
                    break;
                }
        }
    });

    function updateCanisterList(canisters) {
        // Append something like this for each canister:
        // <a href="http://127.0.0.1:4943/?canisterId=bd3sg-teaaa-aaaaa-qaaba-cai">
        //    <button>Open frontend in Browser</button>
        // </a>
        const div = document.querySelector('.canister-links');

        let backend_canisters = [];
        let candid_ui_canister = '';
        let frontend_canister = '';
        for (const canister in canisters) {
            if (canister === "__Candid_UI") {
                candid_ui_canister = canisters[canister]["local"];
            } else if (canister.includes("frontend")) {
                frontend_canister = canisters[canister]["local"];
            } else {
                backend_canisters.push([canister, canisters[canister]["local"]]);
            }
        }

        const a = document.createElement('a');
        a.href = `http://127.0.0.1:4943/?canisterId=${frontend_canister}`;
        a.innerHTML = `<button>Open frontend in Browser</button>`;
        div?.appendChild(a);
        div?.appendChild(document.createElement('br'));
        div?.appendChild(document.createElement('br'));

        for (const canister of backend_canisters) {
            const a = document.createElement('a');
            a.href = `http://127.0.0.1:4943/?canisterId=${candid_ui_canister}&id=${canister[1]}`;
            a.innerHTML = `<button>Open ${canister[0]} Candid UI</button>`;
            div?.appendChild(a);
            div?.appendChild(document.createElement('br'));
            div?.appendChild(document.createElement('br'));
        }
    }

    function dfxStart() {
        vscode.postMessage({ type: 'dfxStart' });
    }

    function dfxStop() {
        vscode.postMessage({ type: 'dfxStop' });
    }

    function dfxDeploy() {
        vscode.postMessage({ type: 'dfxDeploy' });
    }
}());


