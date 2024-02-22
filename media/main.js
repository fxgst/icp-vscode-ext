//@ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {

    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const oldState = vscode.getState();
    updateCanisterList(oldState.canisters);

    document.querySelector('.dfx-start-button')?.addEventListener('click', () => {
        dfxStart();
    });
    document.querySelector('.dfx-stop-button')?.addEventListener('click', () => {
        dfxStop();
    });
    document.querySelector('.dfx-deploy-button')?.addEventListener('click', () => {
        dfxDeploy();
    });
    document.querySelector('.publish-canisters-button')?.addEventListener('click', () => {
        publishCanisters();
    });

    // Handle messages sent from the extension to the webview
    // extension => UI
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
            case 'deactivate':
                {
                    deactivate();
                    break;
                }
            case 'showQRCode':
                {
                    showQRCode(message.value);
                    break;
                }
        }
    });

    /**
     * @param {Element | null} div
     * @param {string} link
     * @param {string} text
     */
    function addOpenCanisterButton(div, link, text) {
        // Produces the following HTML:
        // <a href="link">
        //    <button>text</button>
        // </a>
        const a = document.createElement('a');
        a.href = link;
        a.innerHTML = `<button>${text}</button>`;
        div?.appendChild(a);
        div?.appendChild(document.createElement('br'));
        div?.appendChild(document.createElement('br'));
    }

    /**
     * @param {Element | null} div
     */
    function removeChildren(div) {
        while (div?.firstChild) {
            div.removeChild(div.firstChild);
        }
    }

    function updateCanisterList(canisters) {
        vscode.setState({ canisters: canisters });
        let div = document.querySelector('.canister-links');
        removeChildren(div);

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

        if (frontend_canister !== '') {
            addOpenCanisterButton(div, `http://127.0.0.1:4943/?canisterId=${frontend_canister}`, 'Open frontend in Browser');
        }
        for (const canister of backend_canisters) {
            addOpenCanisterButton(div, `http://127.0.0.1:4943/?canisterId=${candid_ui_canister}&id=${canister[1]}`, `Open ${canister[0]} Candid UI`);
        }
    }

    function showQRCode(accountId) {
        // vscode.setState({ accountId: accountId }); // FIXME: overrides everything
        let qrCode = document.querySelector('.qr-code');
        removeChildren(qrCode);
       
        // show such a QR code: https://gix.design/components/qr-code-generator
        let p = document.createElement('p');
        p.textContent = 'Please transfer 1 ICP to ' + accountId;
        qrCode?.appendChild(p);
    }

    function publishCanisters() {
        vscode.postMessage({ type: 'publishCanisters' });
    }

    function deactivate() {
        vscode.setState({ canisters: null });
        let div = document.querySelector('.canister-links');
        removeChildren(div);
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
