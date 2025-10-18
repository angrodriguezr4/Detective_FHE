# Enigma Solution: A Detective Game with Encrypted Witness Testimonies 🕵️‍♂️

Unravel the mysteries of crime as you step into the shoes of a detective, where every witness testimony is shrouded in the secrecy of **Zama's Fully Homomorphic Encryption technology**. In this exciting detective game, players face a narrative where contradictions are hidden within encrypted witness statements, compelling them to engage deeply with the logic of testimonies to uncover the truth.

## The Challenge of Contradictions

A challenge often encountered in detective fiction is the inconsistency present in witness statements. In real-life investigations, discrepancies can mislead or even derail an entire case. How can players simulate the intense thrill of logical deduction when the core information is obscured? The answer lies in implementing advanced cryptographic techniques, ensuring that even digital evidence retains its integrity while allowing players to engage meaningfully in analysis and deduction.

## Harnessing FHE for a Seamless Experience

To address this challenge, our game leverages **Fully Homomorphic Encryption (FHE)**, allowing players to analyze and engage with encrypted witness testimonies without compromising their confidentiality. By utilizing **Zama's open-source libraries**, particularly the **Concrete** SDK, we ensure that all operations on encrypted data maintain the laws of cryptographic integrity, enabling a fair and immersive game experience. Players can cross-verify statements while remaining oblivious to the raw data, mirroring the investigative process in thrilling detective stories.

## Core Features

- 🔍 **Encrypted Witness Testimonies:** Witness testimonies are encrypted via FHE, ensuring their confidentiality while allowing for logical analysis.
- ⚖️ **Cross-Verification of Statements:** Dynamic gameplay mechanics enable players to logically deduce contradictions between testimonies.
- 🎭 **Immersive Logic and Dialogue System:** Players engage in rich dialogues and deduction sequences that simulate real investigative procedures.
- 📖 **Case Files and Clue Discovery:** Players gather evidence and clues through a well-structured case file system, enhancing the gameplay experience.
- 🖋️ **Crafty Narrative Style:** With influences from noir films, the game's narrative keeps players on their toes, challenging them to think like a real detective.

## Technology Stack

This project integrates several cutting-edge technologies to deliver a seamless gaming experience, including:
- **Zama's Concrete SDK:** Essential for implementing Fully Homomorphic Encryption used for witness testimonies.
- **Node.js:** For the backend and server-side functionalities.
- **Hardhat:** A development environment for compiling and deploying smart contracts.
- **Solidity:** The programming language for smart contract development.

## Directory Structure

Here’s a quick overview of the project structure:

```
Detective_FHE/
│
├── contracts/
│   ├── Detective_FHE.sol           # The main smart contract
│
├── scripts/
│   ├── deploy.js                    # Deployment script
│
├── test/
│   ├── Detective_FHE.test.js        # Test suite for the smart contract
│
├── package.json                     # Project metadata and dependencies
├── hardhat.config.js                # Hardhat configuration file
└── README.md                        # Documentation
```

## Installation Guide

Before running the game, ensure you have downloaded the project files. While installation, please refrain from using `git clone` or any URLs. Instead, follow these steps:

1. Install **Node.js** from the official website if you haven't done so.
2. Make sure you have **Hardhat** installed globally:
   ```bash
   npm install --global hardhat
   ```

3. Navigate to the project directory in your terminal.
4. Install the dependencies, including Zama's libraries:
   ```bash
   npm install
   ```

This command will fetch all the necessary libraries, including those from Zama FHE, allowing you to run the project efficiently.

## Build & Run Guide

To compile, test, and run the project, follow these commands:

1. **Compile the Smart Contracts:**
   ```bash
   npx hardhat compile
   ```

2. **Run Tests:**
   ```bash
   npx hardhat test
   ```

3. **Deploy the Smart Contracts:**
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

Once the deployment is successful, you can begin playing the detective game and exploring the encrypted insights hidden within the testimonies!

```javascript
// Example of logical deduction from encrypted testimonies
function analyzeWitnessStatements(statement1, statement2) {
    const contradiction = decrypt(statement1).logicCheck(statement2);
    if (contradiction) {
        console.log("Inconsistencies found! Time to investigate further!");
    } else {
        console.log("Witnesses corroborate each other. Proceed with the case!");
    }
}
```

## Acknowledgements

### Powered by Zama

A heartfelt thanks to the Zama team for their pioneering work in the field of cryptography and open-source tools. Their commitment to making confidential blockchain applications possible underpins the innovative gameplay of our project, allowing for a unique blend of security and user engagement in the world of digital detective work.

---
Dive into the world of crime with **Enigma Solution**, where your logical skills can lead to the ultimate revelation of truth! 🕵️‍♀️
