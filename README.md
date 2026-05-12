# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Local contract wiring

The app reads on-chain state using these environment variables:

- `VITE_RPC_URL`
- `VITE_CONTRACT_ADDRESS`

1. Create a local env file:

```bash
cp .env.example .env.local
```

2. Set values in `.env.local`:

```bash
VITE_RPC_URL=http://127.0.0.1:8545
VITE_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

3. Start the site:

```bash
npm run dev
```

Notes:

- Keep your local chain (`hardhat node`) running while the site is open.
- The current frontend reads ownership/sold status from chain, but mint transaction submission is not wired yet.

## Minifying embed preview JS (on-chain HTML pipeline)

The standalone embed in `public/embed-preview.html` is not minified in the browser by Vite. When you change its inline module or anything it imports from `src/`, regenerate the bundle from the `mint-site` directory:

1. Install dependencies if you have not already: `npm install`

2. Bundle the embed module with **esbuild** (minified IIFE), run a second **Terser** pass for extra identifier mangling and compression, then minify the surrounding HTML:

```bash
npm run minify:embed
```

This writes `public/generated/embed-preview.inline.min.html` (inline script includes the minified JS). The Solidity placeholder `__TOKEN_ID__` is reserved so Terser does not rename it.

3. If you need **Solidity-sized string chunks** for `abi.encodePacked` (for example pasting into a contract), run:

```bash
npm run chunk:embed
```

That reads the file from step 2 and writes `public/generated/embed-preview.sol-chunks.txt`.

Run `minify:embed` first whenever you change the embed; run `chunk:embed` only when you need to refresh the contract paste artifact.
