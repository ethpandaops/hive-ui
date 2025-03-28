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
- npm

### Installation

1. Clone the repository
```bash
git clone https://github.com/ethpandaops/hive-ui.git
cd hive-ui
```

2. Install dependencies
```bash
make setup
```

3. Start the development server
```bash
make dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Building for Production

```bash
make build
```

The build artifacts will be stored in the `dist/` directory.

## Test results endpoint configuration

We use the [`discovery.json`](/public/discovery.json) file to determine the available result directories.

The following example shows the format of the `discovery.json` file:

```json
[
  {
    "name": "pectra",
    "address": "https://hive.ethpandaops.io/pectra/"
  }
]
```

The address should be the directory where the Hive results are stored.

The UI expects the following files to be there:
- `listing.jsonl` file which contains a list of recent test results separated by newlines.
- `results/` directory that contains more information about specific test results.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [GNU GPL-3.0](LICENSE).
