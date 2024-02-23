import { VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import { useEventListener } from "usehooks-ts";
import { postVSCodeMessage, useVSCodeState } from "../hooks/useVSCode";
import QRCode from "react-qr-code";

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
    </div>
  );
}

function App() {
  const [vscodeState, setVSCodeState] = useVSCodeState();

  // Handle messages sent from the extension to the webview
  // extension => UI
  useEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent
    switch (message.type) {
      case "dfxStart": {
        dfxStart();
        break;
      }
      case "updateCanisterList": {
        setVSCodeState({ ...vscodeState, canisters: message.value });
        break;
      }
      case "deactivate": {
        deactivate();
        break;
      }
      case "showQRCode": {
        setVSCodeState({ ...vscodeState, accountId: message.value });
        break;
      }
    }
  });

  const canisters = vscodeState?.canisters ?? {};

  let frontendCanisters = [];
  let backendCanisters = [];
  let candidUiCanister: string | undefined;
  for (const canister in canisters) {
    if (canister === "__Candid_UI") {
      candidUiCanister = canisters[canister]["local"];
    } else if (canister.includes("frontend")) {
      // TODO: determine if a canister has a frontend based on `dfx.json` frontend config
      frontendCanisters.push({ canister, id: canisters[canister]["local"] });
    } else {
      backendCanisters.push({ canister, id: canisters[canister]["local"] });
    }
  }

  function publishCanisters() {
    postVSCodeMessage({ type: "publishCanisters" });
  }

  function deactivate() {
    setVSCodeState({ canisters: {} });
  }

  function dfxStart() {
    postVSCodeMessage({ type: "dfxStart" });
  }

  function dfxStop() {
    postVSCodeMessage({ type: "dfxStop" });
  }

  function dfxDeploy() {
    postVSCodeMessage({ type: "dfxDeploy" });
  }

  return (
    <main>
      <h2>Develop</h2>

      <div>
        <button onClick={publishCanisters}>
          Publish canisters on ICP mainnet
        </button>
      </div>

      {!!vscodeState?.accountId && (
        <>
          <br />
          <h2>QR Code</h2>

          <p>Please transfer 1 ICP to {vscodeState.accountId}</p>

          <QRCode
            // TODO: maybe refactor to CSS
            style={{
              height: "auto",
              background: "white",
              padding: 10,
              maxWidth: "100%",
              width: "100%",
            }}
            size={256}
            viewBox="0 0 256 256"
            // TODO
            value={`placeholder data`}
          />
        </>
      )}

      <br />
      <h2>Canisters</h2>

      {/* Sanity check */}
      <CanisterListItem
        text="Open nonexistent canister"
        link="http://127.0.0.1:4943/"
      />

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
