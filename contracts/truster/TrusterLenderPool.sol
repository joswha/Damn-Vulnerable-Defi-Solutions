// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TrusterLenderPool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract TrusterLenderPool is ReentrancyGuard {

    using Address for address;

    IERC20 public immutable damnValuableToken;

    constructor (address tokenAddress) {
        damnValuableToken = IERC20(tokenAddress);
    }

    function flashLoan(
        uint256 borrowAmount,
        address borrower,
        address target,
        bytes calldata data
    )
        external
        nonReentrant
    {
        uint256 balanceBefore = damnValuableToken.balanceOf(address(this));
        require(balanceBefore >= borrowAmount, "Not enough tokens in pool");
        
        damnValuableToken.transfer(borrower, borrowAmount);
        // @audit-info : maybe if this fails, the transfer will still work, however, the borrower will not want to repay the loan.
        // @audit : this was indeed the issue; the attacker could call the flashLoan(0) function to send it to the target/
        
        target.functionCall(data);
        // @audit : the target can be the `token` and you can call it's approve function, such that the pool will approve a transfer worth of
        // the entire pool's balance to the target. Without the require on line 45, the exploit could have triggered as I have initially thought
        // (through the use of a gimmick contract, that would simply accept the payment but not do anything with it).

        uint256 balanceAfter = damnValuableToken.balanceOf(address(this));
        require(balanceAfter >= balanceBefore, "Flash loan hasn't been paid back");
    }

}
