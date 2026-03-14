// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AstraeaSBT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // OZ v4: Ownable constructor takes no arguments — msg.sender is set as owner automatically
    constructor() ERC721("Astraea Hacker Verification", "ASTRAEA") {}

    /**
     * @dev Mints a new Soulbound Token to the hacker.
     * Only the deployer (protocol) can call this function.
     */
    function mintVerification(address hacker, string memory ipfsURI) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _mint(hacker, tokenId);
        _setTokenURI(tokenId, ipfsURI);
    }

    /**
     * @dev Override _beforeTokenTransfer to block all transfers (Soulbound).
     * Allows minting (from == address(0)) but blocks transfers.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
        // Block transfers (not minting, not burning)
        if (from != address(0) && to != address(0)) {
            revert("AstraeaSBT: Soulbound - cannot transfer.");
        }
    }
}
