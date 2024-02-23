import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';

// TODO: convert to Sass?
import '../styles/main.css';
import '../styles/reset.css';
import '../styles/vscode.css';

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
);
