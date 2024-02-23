import { useSessionStorage } from 'usehooks-ts';
import type { WebviewApi } from 'vscode-webview';
import makeObservable from '../utils/makeObservable';
import useObservableState from './utils/useObservableState';

/**
 * Type definition for the VS Code state.
 */
export interface VSCodeState {
    canisters?: Record<string, CanisterIds>;
    accountId?: string;
    balance?: number;
}

export interface CanisterIds {
    local?: string;
    ic?: string;
    [network: string]: string | undefined;
}

const vscode: WebviewApi<VSCodeState | undefined> | undefined =
    window.acquireVsCodeApi?.();

export const VSCODE_STORE = makeObservable(vscode.getState());

VSCODE_STORE.subscribe((state) => vscode.setState(state));

// Preferable way to access the `vscode` API in React (instead of `acquireVsCodeApi()`)
export function useVSCode() {
    return vscode;
}

// Get the VS Code state
export function useVSCodeState(): [
    VSCodeState | undefined,
    (state: VSCodeState | undefined) => void,
] {
    return vscode
        ? useObservableState(VSCODE_STORE)
        : useSessionStorage<VSCodeState | undefined>('vscode', undefined);
}

// Send a `postMessage` to VS Code when possible
export const postVSCodeMessage = (message: unknown) => {
    if (vscode) {
        vscode.postMessage(message);
    } else {
        console.log(message);
    }
};
