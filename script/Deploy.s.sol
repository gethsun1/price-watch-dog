// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/PriceWatcher.sol";

contract Deploy is Script {
    function run() external returns (PriceWatcher) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PriceWatcher priceWatcher = new PriceWatcher();
        
        vm.stopBroadcast();
        
        return priceWatcher;
    }
}

