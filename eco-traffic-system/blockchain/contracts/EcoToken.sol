// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// This contract implements the 'Token Issued' logic from your architecture [cite: 30, 319]
contract EcoToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event TripRewarded(address indexed user, uint256 amount, string tripId, uint256 co2Saved);

    constructor() ERC20("EcoTraffic Token", "ECO") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // Only the Backend (Minter) can call this function after verification [cite: 320]
    function mintReward(address to, uint256 amount, string memory tripId, uint256 co2Saved) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TripRewarded(to, amount, tripId, co2Saved);
    }
}