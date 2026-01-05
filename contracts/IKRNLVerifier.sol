// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IKRNLVerifier {
    function verifyProof(bytes calldata proof, uint256 price, uint256 threshold) external view returns (bool);
}