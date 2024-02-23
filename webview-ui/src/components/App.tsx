import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react";
import { useEventListener } from "usehooks-ts";
import { postVSCodeMessage, useVSCodeState } from "../hooks/useVSCode";
import "./App.css";

interface CanisterListItemProps {
  text: string;
  link: string;
}

function CanisterListItem({ text, link }: CanisterListItemProps) {
  return (
    <div>
      <VSCodeLink href={text}>{text}</VSCodeLink>
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

  // function showQRCode(accountId: string) {
  //   // setVSCodeState({ ...vscodeState, accountId: accountId });
  //   let qrCode = document.querySelector(".qr-code");
  //   removeChildren(qrCode);

  //   let p = document.createElement("p");
  //   p.textContent = "Please transfer 1 ICP to " + accountId;
  //   qrCode?.appendChild(p);
  // }

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

      <VSCodeButton onClick={publishCanisters}>
        Publish Canisters on ICP mainnet
      </VSCodeButton>

      {/* TODO: QR Code */}

      <h2>Canisters</h2>

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
