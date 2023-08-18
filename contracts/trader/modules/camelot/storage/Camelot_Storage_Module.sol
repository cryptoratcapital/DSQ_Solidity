// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "@solidstate/contracts/access/access_control/AccessControl.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./Camelot_Common_Storage.sol";
import "../../../external/camelot_interfaces/INFTPool.sol";
import "../../../external/camelot_interfaces/INFTPoolFactory.sol";

/**
 * @title   DSquared Camelot Storage Module
 * @notice  Manage Camelot storage
 * @dev     Warning: This contract is intended for use as a facet of diamond proxy contracts.
 *          Calling it directly may produce unintended or undesirable results.
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
contract Camelot_Storage_Module is AccessControl, Camelot_Common_Storage {
    // solhint-disable var-name-mixedcase
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @notice Camelot NFT pool factory address
    INFTPoolFactory public immutable camelot_nftpool_factory;

    /**
     * @notice Sets the address of the Camelot nft pool factory
     * @param _camelot_nftpool_factory  Camelot nft pool factory address
     */
    constructor(address _camelot_nftpool_factory) {
        camelot_nftpool_factory = INFTPoolFactory(_camelot_nftpool_factory);
    }

    // solhint-enable var-name-mixedcase

    /**
     * @notice Adds or removes batch of nft pools to the set of allowed nft pools
     * @param _pools    Array of pool addresses
     * @param _status   Array of statuses
     */
    function manageNFTPools(address[] calldata _pools, bool[] calldata _status) external onlyRole(EXECUTOR_ROLE) {
        // solhint-disable-next-line reason-string
        require(_pools.length == _status.length, "Camelot_Storage_Module: Length mismatch");
        for (uint256 i; i < _pools.length; ) {
            _manageNFTPool(_pools[i], _status[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Internal function to add or remove a pool from the set of allowed nft pools
     * @param _pool     Pool address
     * @param _status   Status
     */
    function _manageNFTPool(address _pool, bool _status) internal {
        if (_status) {
            (address lptoken, , , , , , , ) = INFTPool(_pool).getPoolInfo();
            require(camelot_nftpool_factory.getPool(lptoken) == _pool, "Invalid pool");
            getCamelotCommonStorage().allowedNFTPools.add(_pool);
        } else {
            getCamelotCommonStorage().allowedNFTPools.remove(_pool);
        }
    }

    /**
     * @notice Adds or removes batch of nitro pools to the set of allowed nitro pools
     * @param _pools    Array of pool addresses
     * @param _status   Array of statuses
     */
    function manageNitroPools(address[] calldata _pools, bool[] calldata _status) external onlyRole(EXECUTOR_ROLE) {
        // solhint-disable-next-line reason-string
        require(_pools.length == _status.length, "Camelot_Storage_Module: Length mismatch");
        for (uint256 i; i < _pools.length; ) {
            _manageNitroPool(_pools[i], _status[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Internal function to add or remove a pool from the set of allowed nitro pools
     * @param _pool     Pool address
     * @param _status   Status
     */
    function _manageNitroPool(address _pool, bool _status) internal {
        if (_status) {
            // @todo Add Check for nitro pool
            getCamelotCommonStorage().allowedNitroPools.add(_pool);
        } else {
            getCamelotCommonStorage().allowedNitroPools.remove(_pool);
        }
    }

    /**
     * @notice Adds or removes batch of executors to the set of allowed executors
     * @param _executors    Array of executor addresses
     * @param _status       Array of statuses
     */
    function manageExecutors(address[] calldata _executors, bool[] calldata _status) external onlyRole(EXECUTOR_ROLE) {
        // solhint-disable-next-line reason-string
        require(_executors.length == _status.length, "Camelot_Storage_Module: Length mismatch");
        for (uint256 i; i < _executors.length; ) {
            _manageExecutor(_executors[i], _status[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Internal function to add or remove an executor from the set of allowed executors
     * @param _executor     Executor address
     * @param _status       Status
     */
    function _manageExecutor(address _executor, bool _status) internal {
        require(_executor != address(0), 'Camelot_Storage_Module: Zero address');
        if (_status) {
            getCamelotCommonStorage().allowedExecutors.add(_executor);
        } else {
            getCamelotCommonStorage().allowedExecutors.remove(_executor);
        }
    }

    /**
     * @notice Adds or removes batch of receivers to the set of allowed receivers
     * @param _receivers    Array of receiver addresses
     * @param _status       Array of statuses
     */
    function manageReceivers(address[] calldata _receivers, bool[] calldata _status) external onlyRole(EXECUTOR_ROLE) {
        // solhint-disable-next-line reason-string
        require(_receivers.length == _status.length, "Camelot_Storage_Module: Length mismatch");
        for (uint256 i; i < _receivers.length; ) {
            _manageReceiver(_receivers[i], _status[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Internal function to add or remove a receiver from the set of allowed receivers
     * @param _receiver     Receiver address
     * @param _status       Status
     */
    function _manageReceiver(address _receiver, bool _status) internal {
        require(_receiver != address(0), 'Camelot_Storage_Module: Zero address');
        if (_status) {
            getCamelotCommonStorage().allowedReceivers.add(_receiver);
        } else {
            getCamelotCommonStorage().allowedReceivers.remove(_receiver);
        }
    }

    // --------- Views ---------

    /**
     * @notice  Returns all allowed NFT Pools
     */
    function getAllowedNFTPools() external view returns (address[] memory) {
        return getCamelotCommonStorage().allowedNFTPools.values();
    }

    /**
     * @notice  Returns all allowed Nitro Pools
     */
    function getAllowedNitroPools() external view returns (address[] memory) {
        return getCamelotCommonStorage().allowedNitroPools.values();
    }

    /**
     * @notice  Returns all allowed Executors
     */
    function getAllowedExecutors() external view returns (address[] memory) {
        return getCamelotCommonStorage().allowedExecutors.values();
    }

    /**
     * @notice  Returns all allowed Receivers
     */
    function getAllowedReceivers() external view returns (address[] memory) {
        return getCamelotCommonStorage().allowedReceivers.values();
    }
}
