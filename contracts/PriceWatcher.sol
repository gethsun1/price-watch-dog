// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PriceWatcher
/// @notice Minimal example contract to receive KRNL watchdog results. Proof verification
/// is stubbed; integrate actual proof verification when SDK on-chain helpers are wired.
contract PriceWatcher {
    event Requested(address indexed requester, string token, uint256 lower, uint256 upper);
    event ResultHandled(bytes32 digest, string status, uint256 price, string chain, address signer);

    bool public paused;

    function requestCheck(string calldata token, uint256 lower, uint256 upper) external {
        emit Requested(msg.sender, token, lower, upper);
    }

    /// @param result ABI-encoded payload from the kernel delivery.
    /// Expected to decode (string status, uint256 price, string token, string chain).
    /// @param proof Placeholder for proof bytes; verify off-chain/on-chain as needed.
    function handleResult(bytes calldata result, bytes calldata proof) external {
        // TODO: verify proof when KRNL on-chain verification helpers are integrated.
        (string memory status, uint256 price, string memory token, string memory chain) =
            abi.decode(result, (string, uint256, string, string));

        // Simple example action: pause if price is above range.
        if (_equals(status, "ABOVE_RANGE")) {
            paused = true;
        }

        emit ResultHandled(keccak256(result), status, price, chain, msg.sender);

        // unused proof placeholder
        proof;
        token;
    }

    function _equals(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}

