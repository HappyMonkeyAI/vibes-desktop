/**
 * React 19 + Arco compatibility shim.
 *
 * Arco's internal react-dom util grabs `createRoot` from the `react-dom` MAIN
 * entry at import time, but React 19 moved it to `react-dom/client`. Without a
 * fix, Arco falls into its legacy branch and calls `ReactDOM.render`, which no
 * longer exists — so any static `Message.error()` / `Modal.confirm()` etc.
 * crashes the renderer on an error path.
 *
 * Arco ships `setCreateRoot` exactly for this: inject the client-entry
 * createRoot before any Arco component renders. The package publishes two builds
 * (`main` → lib/ CJS, `module` → es/) and different consumers resolve to
 * different ones (Vite build → es/, Vitest/node SSR → lib/), so we patch BOTH
 * instances to be safe. Import this module FIRST (before App) so it runs ahead
 * of Arco's own `setCopyRender()` initialisation.
 */
import { createRoot } from 'react-dom/client';
import { setCreateRoot as setCreateRootEs } from '@arco-design/web-react/es/_util/react-dom';
import { setCreateRoot as setCreateRootLib } from '@arco-design/web-react/lib/_util/react-dom';

setCreateRootEs(createRoot);
setCreateRootLib(createRoot);

export {};
