// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// NOTE:
// This contract is a reference consumer used to demonstrate how
// KRNL-delivered, attested payloads can be verified and interpreted on-chain.
// The kernel itself does not enforce bounds or reactions.

/// @title PriceWatcher
/// @notice Receives KRNL watchdog deliveries and verifies the attestor proof
/// using an ECDSA signature over the quoted price payload. Pauses the contract
/// if the reported status is ABOVE_RANGE.
contract PriceWatcher {
    struct ProofPayload {
        bytes32 digest;
        bytes signature;
        address signer;
        string token;
        string chain;
        uint256 priceE8;
        uint8 priceDecimals;
        string currency;
        string source;
        uint256 fetchedAt;
        uint256 provedAt;
    }

    event Requested(address indexed requester, string token, uint256 lower, uint256 upper);
    event ResultHandled(
        bytes32 digest,
        string status,
        uint256 priceE8,
        uint8 priceDecimals,
        string chain,
        address attestor,
        address caller
    );

    bool public paused;

    error InvalidProof();
    error InvalidSignatureLength();

    function requestCheck(string calldata token, uint256 lower, uint256 upper) external {
        emit Requested(msg.sender, token, lower, upper);
    }

    /// @param result ABI-encoded payload from the kernel delivery.
    /// Expected to decode (string status, uint256 priceE8, uint8 priceDecimals, string token, string chain).
    /// @param proof ABI-encoded ProofPayload {digest, signature, signer, token, chain, priceE8, priceDecimals,
    /// currency, source, fetchedAt, provedAt}.
    function handleResult(bytes calldata result, bytes calldata proof) external {
        (string memory status, uint256 priceE8, uint8 priceDecimals, string memory token, string memory chain) =
            abi.decode(result, (string, uint256, uint8, string, string));

        (
            bytes32 digest,
            bytes memory signature,
            address signer,
            string memory proofToken,
            string memory proofChain,
            uint256 proofPriceE8,
            uint8 proofPriceDecimals,
            string memory currency,
            string memory source,
            uint256 fetchedAt,
            uint256 provedAt
        ) =
            abi.decode(
                proof,
                (bytes32, bytes, address, string, string, uint256, uint8, string, string, uint256, uint256)
            );

        ProofPayload memory p = ProofPayload(
            digest,
            signature,
            signer,
            proofToken,
            proofChain,
            proofPriceE8,
            proofPriceDecimals,
            currency,
            source,
            fetchedAt,
            provedAt
        );

        bytes32 expectedDigest =
            keccak256(abi.encode(p.token, p.chain, p.priceE8, p.priceDecimals, p.currency, p.source, p.fetchedAt));
        if (
            p.digest != expectedDigest ||
            p.priceE8 != priceE8 ||
            p.priceDecimals != priceDecimals ||
            !_equals(p.token, token) ||
            !_equals(p.chain, chain)
        ) {
            revert InvalidProof();
        }

        address recovered = _recoverEthSignedMessage(p.digest, p.signature);
        if (recovered != p.signer) {
            revert InvalidProof();
        }

        if (_equals(status, "ABOVE_RANGE")) {
            paused = true;
        }

        emit ResultHandled(p.digest, status, priceE8, priceDecimals, chain, p.signer, msg.sender);
    }

    function _recoverEthSignedMessage(bytes32 digest, bytes memory signature)
        internal
        pure
        returns (address)
    {
        if (signature.length != 65) {
            revert InvalidSignatureLength();
        }

        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)
        );

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        // adjust v if needed
        if (v < 27) {
            v += 27;
        }

        address signer = ecrecover(ethHash, v, r, s);
        if (signer == address(0)) {
            revert InvalidProof();
        }
        return signer;
    }

    function _equals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
