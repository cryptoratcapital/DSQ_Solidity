// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.13;

import "../../../external/camelot_interfaces/INFTPoolFactory.sol";

/**
 * @title   DSquared Camelot Storage Module Interface
 * @notice  Allows interacting with Camelot common storage
 * @author  HessianX
 * @custom:developer    BowTiedPickle
 * @custom:developer    BowTiedOriole
 */
interface ICamelot_Storage_Module {
    // --------- External Functions ---------

    function manageNFTPools(address[] calldata _pools, bool[] calldata _status) external;

    function manageNitroPools(address[] calldata _pools, bool[] calldata _status) external;

    function manageExecutors(address[] calldata _executors, bool[] calldata _status) external;

    function manageReceivers(address[] calldata _receivers, bool[] calldata _status) external;

    // --------- Getter Functions ---------

    function camelot_nftpool_factory() external view returns (INFTPoolFactory);

    function getAllowedNFTPools() external view returns (address[] memory);

    function getAllowedNitroPools() external view returns (address[] memory);

    function getAllowedExecutors() external view returns (address[] memory);

    function getAllowedReceivers() external view returns (address[] memory);
}
