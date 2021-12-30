// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/libraries/SafeMath.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external returns (uint256);
}

/**
 * @title PuppetV2Pool
 * @author Damn Vulnerable DeFi (https://damnvulnerabledefi.xyz)
 */
contract PuppetV2Pool {
    using SafeMath for uint256;

    address private _uniswapPair;
    address private _uniswapFactory;
    IERC20 private _token;
    IERC20 private _weth;
    
    mapping(address => uint256) public deposits;
        
    event Borrowed(address indexed borrower, uint256 depositRequired, uint256 borrowAmount, uint256 timestamp);

    constructor (
        address wethAddress,
        address tokenAddress,
        address uniswapPairAddress,
        address uniswapFactoryAddress
    ) public {
        _weth = IERC20(wethAddress);
        _token = IERC20(tokenAddress);
        _uniswapPair = uniswapPairAddress;
        _uniswapFactory = uniswapFactoryAddress;
    }

    /**
     * @notice Allows borrowing `borrowAmount` of tokens by first depositing three times their value in WETH
     *         Sender must have approved enough WETH in advance.
     *         Calculations assume that WETH and borrowed token have same amount of decimals.
     */
    function borrow(uint256 borrowAmount) external {
        require(_token.balanceOf(address(this)) >= borrowAmount, "Not enough token balance");

        // Calculate how much WETH the user must deposit
        uint256 depositOfWETHRequired = calculateDepositOfWETHRequired(borrowAmount);
        
        // Take the WETH
        _weth.transferFrom(msg.sender, address(this), depositOfWETHRequired);

        // internal accounting
        deposits[msg.sender] += depositOfWETHRequired;

        require(_token.transfer(msg.sender, borrowAmount));

        emit Borrowed(msg.sender, depositOfWETHRequired, borrowAmount, block.timestamp);
    }

    function calculateDepositOfWETHRequired(uint256 tokenAmount) public view returns (uint256) {
        return _getOracleQuote(tokenAmount).mul(3) / (10 ** 18);
    }

    // Fetch the price from Uniswap v2 using the official libraries
    function _getOracleQuote(uint256 amount) private view returns (uint256) {
        (uint256 reservesWETH, uint256 reservesToken) = UniswapV2Library.getReserves(
            _uniswapFactory, address(_weth), address(_token)
        );
        // calculate the price based on tokens from reserves.
        // @audit the issue was here:
        // reservesToken goes UP while reservesWETH goes DOWN. arithmetics: 1000000 * res_weth * 3 / res_tok
        return UniswapV2Library.quote(amount.mul(10 ** 18), reservesToken, reservesWETH);
    }

    // @audit-info : displaying purposes only
    function getOracle() public view returns(uint256, uint256) {
        (uint256 reservesWETH, uint256 reservesToken) = UniswapV2Library.getReserves(
            _uniswapFactory, address(_weth), address(_token)
        );
        return (reservesWETH, reservesToken);
    } 
}

/*
1. One could swap DVT into WETH. That won't provide enough WETH to borrow.
	CURR WETH 9.9
	Reserved WETH 0.09930486593843098
	Reserved TOK 10099.999999999998
	
	>>> 1000000 * res_weth * 3 / res_tok 
	29.4059697088809
2. Transform ETH to WETH, and get the req 29.4 - 9.9 WETH, and then borrow the 1000000 DVT.

https://github.com/Uniswap/v2-periphery/blob/master/contracts/libraries/UniswapV2Library.sol
https://github.com/Uniswap/v2-core/blob/master/contracts/UniswapV2Pair.sol
https://github.com/Uniswap/v2-periphery/blob/master/contracts/UniswapV2Router02.sol

Reserves get updated via the _update method, used in mint(), burn(), swap() and proabably the needed sync()!!
what about skim()??? 
*/