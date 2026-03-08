// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LogiGuard
 * @notice Immutable on-chain log for logistics package scan completions.
 *         Deployed to local Ganache testnet to satisfy FR-03.
 *
 * Each package scan is recorded with its payload hash, status, and timestamp.
 * Records are append-only — no update or delete functions exist.
 */
contract LogiGuard {
    // ─── Events ───────────────────────────────────────────────────────────────
    event PackageLogged(
        string  indexed packageId,
        bytes32         payloadHash,
        string          status,
        uint256         timestamp
    );

    // ─── Storage ──────────────────────────────────────────────────────────────
    struct PackageRecord {
        bytes32 payloadHash;
        string  status;
        uint256 timestamp;
        bool    exists;
    }

    mapping(string => PackageRecord) private _records;
    address public immutable owner;

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "LogiGuard: caller is not owner");
        _;
    }

    // ─── Functions ────────────────────────────────────────────────────────────

    /**
     * @notice Log a package scan completion to the blockchain.
     * @param packageId  UUID of the package (from backend DB)
     * @param payloadHash  keccak256 hash of the package JSON payload
     * @param status       "good" | "damaged" | "empty"
     */
    function logPackage(
        string calldata packageId,
        bytes32         payloadHash,
        string calldata status
    ) external onlyOwner {
        require(!_records[packageId].exists, "LogiGuard: package already logged");
        require(payloadHash != bytes32(0),   "LogiGuard: payload hash cannot be zero");

        _records[packageId] = PackageRecord({
            payloadHash: payloadHash,
            status:      status,
            timestamp:   block.timestamp,
            exists:      true
        });

        emit PackageLogged(packageId, payloadHash, status, block.timestamp);
    }

    /**
     * @notice Retrieve the on-chain record for a package.
     * @return payloadHash  The hash logged at scan time.
     * @return status       The classification result.
     * @return timestamp    The block timestamp when logged.
     */
    function getPackageLog(string calldata packageId)
        external
        view
        returns (bytes32 payloadHash, string memory status, uint256 timestamp)
    {
        PackageRecord storage record = _records[packageId];
        return (record.payloadHash, record.status, record.timestamp);
    }

    /**
     * @notice Verify a package by comparing a given hash against the stored one.
     */
    function verifyPackage(string calldata packageId, bytes32 payloadHash)
        external
        view
        returns (bool)
    {
        return _records[packageId].payloadHash == payloadHash;
    }
}
