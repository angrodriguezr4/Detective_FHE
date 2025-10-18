pragma solidity ^0.8.24;
import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DetectiveFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error RateLimited();
    error InvalidBatch();
    error StaleWrite();
    error ReplayAttempt();
    error InvalidState();

    address public owner;
    bool public paused;
    uint256 public constant MIN_INTERVAL = 30 seconds;
    uint256 public cooldownSeconds = 30;
    uint256 public batchSizeLimit = 10;
    uint256 public modelVersion;
    mapping(address => uint256) public lastActionAt;
    mapping(address => bool) public isProvider;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => DecryptionContext) public decryptionContexts;
    mapping(uint256 => mapping(address => bool)) public batchSubmitters;

    struct WitnessTestimony {
        euint32 encryptedStatement;
        euint32 encryptedConsistencyScore;
        bool initialized;
    }
    struct Batch {
        uint256 id;
        uint256 modelVersion;
        uint256 testimonyCount;
        mapping(uint256 => WitnessTestimony) testimonies;
        euint32 encryptedAggregateScore;
        bool isOpen;
        bool processed;
    }
    struct DecryptionContext {
        uint256 modelId;
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
        address requester;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event BatchSizeLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event TestimonySubmitted(address indexed witness, uint256 indexed batchId, uint256 testimonyIndex);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, address indexed requester);
    event DecryptionComplete(uint256 indexed requestId, uint256 indexed batchId, uint256 aggregateScore);
    event ModelVersionUpdated(uint256 oldVersion, uint256 newVersion);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }
    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }
    modifier rateLimited() {
        if (block.timestamp < lastActionAt[msg.sender] + cooldownSeconds) {
            revert RateLimited();
        }
        lastActionAt[msg.sender] = block.timestamp;
        _;
    }

    constructor() {
        owner = msg.sender;
        modelVersion = 1;
        batches[1].id = 1;
        batches[1].isOpen = true;
        batches[1].modelVersion = modelVersion;
        emit BatchOpened(1);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    function addProvider(address provider) external onlyOwner {
        isProvider[provider] = true;
        emit ProviderAdded(provider);
    }
    function removeProvider(address provider) external onlyOwner {
        isProvider[provider] = false;
        emit ProviderRemoved(provider);
    }
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            paused = true;
            emit Paused(msg.sender);
        } else {
            paused = false;
            emit Unpaused(msg.sender);
        }
    }
    function setCooldown(uint256 newCooldown) external onlyOwner {
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldown;
        emit CooldownUpdated(oldCooldown, newCooldown);
    }
    function setBatchSizeLimit(uint256 newLimit) external onlyOwner {
        require(newLimit > 0, "Invalid limit");
        uint256 oldLimit = batchSizeLimit;
        batchSizeLimit = newLimit;
        emit BatchSizeLimitUpdated(oldLimit, newLimit);
    }
    function setModelVersion(uint256 newVersion) external onlyOwner {
        uint256 oldVersion = modelVersion;
        modelVersion = newVersion;
        emit ModelVersionUpdated(oldVersion, newVersion);
    }

    function openBatch() external onlyOwner whenNotPaused {
        uint256 batchId = batches[modelVersion].id + 1;
        require(batchId > batches[modelVersion].id, "Batch ID overflow");
        batches[batchId].id = batchId;
        batches[batchId].isOpen = true;
        batches[batchId].modelVersion = modelVersion;
        batches[batchId].testimonyCount = 0;
        batches[batchId].processed = false;
        emit BatchOpened(batchId);
    }
    function closeBatch(uint256 batchId) external onlyOwner whenNotPaused {
        if (batchId == 0 || !batches[batchId].isOpen) revert InvalidBatch();
        batches[batchId].isOpen = false;
        emit BatchClosed(batchId);
    }

    function submitTestimony(
        uint256 batchId,
        euint32 encryptedStatement,
        euint32 encryptedConsistencyScore
    ) external onlyProvider whenNotPaused rateLimited {
        if (batchId == 0 || !batches[batchId].isOpen) revert InvalidBatch();
        if (batches[batchId].testimonyCount >= batchSizeLimit) revert InvalidBatch();
        if (batches[batchId].modelVersion != modelVersion) revert StaleWrite();

        uint256 testimonyIndex = batches[batchId].testimonyCount;
        batches[batchId].testimonies[testimonyIndex].encryptedStatement = _initIfNeeded(encryptedStatement);
        batches[batchId].testimonies[testimonyIndex].encryptedConsistencyScore = _initIfNeeded(encryptedConsistencyScore);
        batches[batchId].testimonies[testimonyIndex].initialized = true;
        batches[batchId].testimonyCount++;
        batchSubmitters[batchId][msg.sender] = true;
        emit TestimonySubmitted(msg.sender, batchId, testimonyIndex);
    }

    function aggregateBatch(uint256 batchId) external whenNotPaused rateLimited {
        if (batchId == 0 || batches[batchId].isOpen || batches[batchId].processed) revert InvalidBatch();
        if (batches[batchId].modelVersion != modelVersion) revert StaleWrite();

        euint32 memory acc = FHE.asEuint32(0);
        for (uint256 i = 0; i < batches[batchId].testimonyCount; i++) {
            WitnessTestimony storage testimony = batches[batchId].testimonies[i];
            _requireInitialized(testimony.encryptedConsistencyScore, "consistency score");
            acc = FHE.add(acc, testimony.encryptedConsistencyScore);
        }
        batches[batchId].encryptedAggregateScore = acc;
        batches[batchId].processed = true;
    }

    function requestBatchDecryption(uint256 batchId) external whenNotPaused rateLimited returns (uint256 requestId) {
        if (batchId == 0 || batches[batchId].isOpen || !batches[batchId].processed) revert InvalidBatch();
        if (batches[batchId].modelVersion != modelVersion) revert StaleWrite();

        euint32 memory aggScore = batches[batchId].encryptedAggregateScore;
        _requireInitialized(aggScore, "aggregate score");
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(aggScore);
        bytes32 stateHash = _hashCiphertexts(cts);
        requestId = FHE.requestDecryption(cts, this.handleDecryptionCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({
            modelId: modelVersion,
            batchId: batchId,
            stateHash: stateHash,
            processed: false,
            requester: msg.sender
        });
        emit DecryptionRequested(requestId, batchId, msg.sender);
    }

    function handleDecryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();
        DecryptionContext memory ctx = decryptionContexts[requestId];
        if (ctx.modelId != modelVersion) revert StaleWrite();

        euint32 memory aggScore = batches[ctx.batchId].encryptedAggregateScore;
        _requireInitialized(aggScore, "aggregate score");
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(aggScore);
        bytes32 currHash = _hashCiphertexts(cts);
        if (currHash != ctx.stateHash) revert InvalidState();

        FHE.checkSignatures(requestId, cleartexts, proof);
        uint256 plaintextScore = abi.decode(cleartexts, (uint256));
        decryptionContexts[requestId].processed = true;
        emit DecryptionComplete(requestId, ctx.batchId, plaintextScore);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }
    function _initIfNeeded(euint32 x) internal returns (euint32) {
        if (!FHE.isInitialized(x)) {
            x = FHE.asEuint32(0);
        }
        return x;
    }
    function _requireInitialized(euint32 x, string memory tag) internal pure {
        if (!FHE.isInitialized(x)) {
            revert(string(abi.encodePacked("Uninitialized: ", tag)));
        }
    }
}