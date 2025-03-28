# Hive UI

A web interface for [Hive](https://github.com/ethereum/hive) - the integration testing framework of Ethereum.

An example of the UI can be found at the ethPandaops hive address: [https://hive.ethpandaops.io](https://hive.ethpandaops.io)

<div align="center">
  <img src="public/img/hive-logo.png" alt="Hive Logo" width="250">
</div>

## Overview

Hive UI provides a user-friendly interface for viewing and analyzing test results from the Ethereum Hive testing framework. It allows users to browse test runs, filter results, and view detailed information about test performance across different Ethereum clients.

***Note:*** This project is still under development and not all features are available. You should still use [hiveview](https://github.com/ethereum/hive/tree/master/cmd/hiveview) for now.

Missing features:
- Test details page
- Log details page
- Test run comparison
- Better filtering and sorting

## Features

- 🔍 Browse and filter test runs across multiple result directories
- 📊 Visualize test results and status

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/ethpandaops/hive-ui.git
cd hive-ui
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Building for Production

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [GNU GPL-3.0](LICENSE).
