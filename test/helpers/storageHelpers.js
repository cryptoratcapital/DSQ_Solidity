module.exports = { toBytes32, setStorageAt, setTokenBalance, getSlot, findBalanceSlot };

function toBytes32(bn) {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
}

async function setStorageAt(address, index, value) {
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
  await ethers.provider.send("evm_mine", []); // Just mines to the next block
}

async function setTokenBalance(tokenAddress, slot, accountAddress, newBalance) {
  const index = ethers.utils
    .solidityKeccak256(
      ["uint256", "uint256"],
      [accountAddress, slot], // key, slot
    )
    .replace(/0x0+/, "0x");

  await setStorageAt(tokenAddress, index, toBytes32(newBalance));
}

function getSlot(userAddress, mappingSlot) {
  return ethers.utils.hexStripZeros(ethers.utils.solidityKeccak256(["uint256", "uint256"], [userAddress, mappingSlot]));
}

async function checkSlot(erc20, mappingSlot) {
  const contractAddress = erc20.address;
  const userAddress = ethers.constants.AddressZero;

  // the slot must be a hex string stripped of leading zeros! no padding!
  // https://ethereum.stackexchange.com/questions/129645/not-able-to-set-storage-slot-on-hardhat-network
  const balanceSlot = getSlot(userAddress, mappingSlot);

  // storage value must be a 32 bytes long padded with leading zeros hex string
  const value = 0xdeadbeef;
  const storageValue = ethers.utils.hexlify(ethers.utils.zeroPad(value, 32));

  await ethers.provider.send("hardhat_setStorageAt", [contractAddress, balanceSlot, storageValue]);
  return (await erc20.balanceOf(userAddress)) == value;
}

async function findBalanceSlot(erc20) {
  const snapshot = await network.provider.send("evm_snapshot");
  for (let slotNumber = 0; slotNumber < 100; slotNumber++) {
    try {
      if (await checkSlot(erc20, slotNumber)) {
        await ethers.provider.send("evm_revert", [snapshot]);
        return slotNumber;
      }
    } catch (e) {
      console.error(e);
    }

    await ethers.provider.send("evm_revert", [snapshot]);
  }
}
