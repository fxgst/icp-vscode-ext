import {
    VSCodeDivider,
    VSCodeDropdown,
    VSCodeOption,
    VSCodePanels,
    VSCodePanelTab,
    VSCodePanelView,
} from '@vscode/webview-ui-toolkit/react';
import { useEventListener, useInterval } from 'usehooks-ts';
import { postVSCodeMessage, useVSCodeState } from '../hooks/useVSCode';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface CanisterListItemProps {
    text: string;
    link: string;
}

function CanisterListItem({ text, link }: CanisterListItemProps) {
    return (
        <div>
            <a href={link}>
                <button>{text}</button>
            </a>
            <br />
            <br />
        </div>
    );
}

type DeployMode = 'Local' | 'Playground' | 'ICP mainnet';

const deployModes: DeployMode[] = ['Local', 'Playground', 'ICP mainnet'];

function App() {
    const [vscodeState, setVSCodeState] = useVSCodeState();
    const [deployMode, setDeployMode] = useState<DeployMode>('Local');
    const balanceRefreshIntervalSeconds = 5;

    useInterval(() => {
        icpBalance();
        xdrBalance();
    }, balanceRefreshIntervalSeconds * 1000);

    // Handle messages sent from the extension to the webview
    // extension => UI
    useEventListener('message', (event) => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'dfxStart': {
                dfxStart();
                break;
            }
            case 'updateCanisterList': {
                setVSCodeState({ ...vscodeState, canisters: message.value });
                break;
            }
            case 'deactivate': {
                deactivate();
                break;
            }
            case 'showQRCode': {
                setVSCodeState({ ...vscodeState, accountId: message.value });
                break;
            }
            case 'icpBalance': {
                setVSCodeState({ ...vscodeState, icpBalance: message.value });
                break;
            }
            case 'xdrBalance': {
                setVSCodeState({ ...vscodeState, xdrBalance: message.value });
                break;
            }
            case 'requiredIcp': {
                setVSCodeState({ ...vscodeState, requiredIcp: message.value });

                break;
            }
        }
    });

    const canisters = vscodeState?.canisters ?? {};

    let frontendCanisters = [];
    let backendCanisters = [];
    let candidUiCanister: string | undefined;
    for (const canister in canisters) {
        if (canister === '__Candid_UI') {
            candidUiCanister = canisters[canister]['local'];
        } else if (canister.includes('frontend')) {
            // TODO: determine if a canister has a frontend based on `dfx.json` frontend config
            frontendCanisters.push({
                canister,
                id: canisters[canister]['local'],
            });
        } else {
            backendCanisters.push({
                canister,
                id: canisters[canister]['local'],
            });
        }
    }

    function publishCanisters() {
        postVSCodeMessage({ type: 'publishCanisters' });
    }

    function deactivate() {
        setVSCodeState(undefined);
    }

    function dfxStart() {
        postVSCodeMessage({ type: 'dfxStart' });
    }

    function dfxStop() {
        postVSCodeMessage({ type: 'dfxStop' });
    }

    function dfxDeploy() {
        postVSCodeMessage({ type: 'dfxDeploy' });
    }

    function icpBalance() {
        postVSCodeMessage({ type: 'icpBalance' });
    }

    function xdrBalance() {
        postVSCodeMessage({ type: 'xdrBalance' });
    }

    return (
        <main>
            <h2>Develop</h2>
            <br />

            <label htmlFor="deploy-dropdown">Deployment mode:</label>
            <br />
            <VSCodeDropdown value={deployMode}>
                {deployModes.map((mode) => (
                    <VSCodeOption onSelect={() => setDeployMode(mode)}>
                        {mode}
                    </VSCodeOption>
                ))}
            </VSCodeDropdown>
            <VSCodeDivider />
            {deployMode === 'Local' && (
                <button onClick={dfxDeploy}>Deploy locally</button>
            )}
            {deployMode === 'Playground' && (
                // TODO
                <button onClick={undefined}>Deploy to playground</button>
            )}
            {deployMode === 'ICP mainnet' && (
                <>
                    <div>
                        <button onClick={publishCanisters}>
                            Deploy on ICP mainnet
                        </button>
                    </div>

                    {!!vscodeState?.accountId && (
                        <>
                            <br />
                            <h2>QR Code</h2>

                            <p>
                                Please transfer {vscodeState.requiredIcp ?? 420}{' '}
                                ICP to {vscodeState.accountId}
                            </p>

                            <QRCode
                                // TODO: maybe refactor to CSS
                                style={{
                                    height: 'auto',
                                    background: 'white',
                                    padding: 10,
                                    maxWidth: '100%',
                                    width: '100%',
                                }}
                                size={256}
                                viewBox="0 0 256 256"
                                value={vscodeState.accountId}
                            />
                            <br />
                            <h3>ICP balance: {vscodeState.icpBalance ?? 42}</h3>
                            <h3>
                                XDR (T cycles) balance:{' '}
                                {vscodeState.xdrBalance ?? 42}
                            </h3>
                        </>
                    )}
                </>
            )}

            <br />
            <VSCodeDivider />
            <br />

            <div>
                {frontendCanisters.map(({ canister, id }, i) => (
                    <CanisterListItem
                        key={i}
                        text={`Open '${canister}' in browser`}
                        link={`http://127.0.0.1:4943/?canisterId=${id}`}
                    />
                ))}
                {backendCanisters.map(({ canister, id }, i) => (
                    <CanisterListItem
                        key={i}
                        text={`Open '${canister}' Candid UI`}
                        link={`http://127.0.0.1:4943/?canisterId=${candidUiCanister}&id=${id}`}
                    />
                ))}
            </div>
        </main>
    );
}

export default App;
