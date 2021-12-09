// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Address.sol";

interface IFlashLoanEtherReceiver {
    function execute() external payable;
}

/**
 * @title SideEntranceLenderPool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract SideEntranceLenderPool {
    using Address for address payable;

    mapping (address => uint256) private balances;

    function deposit() external payable {
        //@audit-info in theory this could overflow, however it doesn't seem relevant.
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amountToWithdraw = balances[msg.sender];
        //@audit-info this protects against re-entrance, since it updates the balance first and only then sends the money.
        balances[msg.sender] = 0;
        payable(msg.sender).sendValue(amountToWithdraw);
    }

    function flashLoan(uint256 amount) external {
        uint256 balanceBefore = address(this).balance;
        require(balanceBefore >= amount, "Not enough ETH in balance");
        
        //@audit-info it expects that the receiver is a contract of the FlashLoanEtherReceiver format, that would handle something via the execute function.
        IFlashLoanEtherReceiver(msg.sender).execute{value: amount}();
        //@audit what we can do is: 1. execute the loan, which gives us the entire amount(1000 ETH)
        // 2. and then from our contract we can deposit() that amount of money back in, which would set the state. the deposit basically handles returning the loan.
        // 3. we then know that our balances[] will be set to 11000 ETH then we simply withdraw that.


        //@audit this passed when we deposit() the money back into the contract.
        require(address(this).balance >= balanceBefore, "Flash loan hasn't been paid back");   
        //TODO: !!!!!!!!!!! PAY ATTENTION TO FUNCTION CALL INSOLDITY !!! THE `()` THING AFTER EACH FUNCTION.     
    }
}
 