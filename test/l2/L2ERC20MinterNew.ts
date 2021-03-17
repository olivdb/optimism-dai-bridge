import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L2ERC20Minter__factory } from '../../typechain'
import { deploy, deployMock } from '../helpers'

// const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
// const ERR_INVALID_X_DOMAIN_MSG_SENDER = 'OVM_XCHAIN: wrong sender of cross-domain message'

describe('OVM_L2ERC20Minter', () => {
  describe('finalizeDeposit', () => {
    const depositAmount = 100

    it('mints new tokens', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Erc20DepositMock, l2CrossDomainMessengerMock, l2Minter } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1Erc20DepositMock.address)

      await l2Minter.connect(l2MessengerImpersonator).finalizeDeposit(user1.address, depositAmount)
    })

    it('reverts when called not by XDomainMessenger')
    it('reverts when called by XDomainMessenger but not relying message from l2Minter')
  })

  describe('withdraw', () => {
    const withdrawAmount = 100

    it('sends xchain message and burns tokens', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Erc20DepositMock, l2CrossDomainMessengerMock, l2Dai, l2Minter } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })

      await l2Minter.connect(user1).withdraw(withdrawAmount)
      const withdrawCallToMessengerCall = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l2Dai.balanceOf(user1.address)).to.equal(INITIAL_TOTAL_L1_SUPPLY - withdrawAmount)
      expect(await l2Dai['totalSupply()']()).to.equal(INITIAL_TOTAL_L1_SUPPLY - withdrawAmount)

      expect(withdrawCallToMessengerCall._target).to.equal(l1Erc20DepositMock.address)
      expect(withdrawCallToMessengerCall._message).to.equal(
        l1Erc20DepositMock.interface.encodeFunctionData('finalizeWithdrawal', [user1.address, withdrawAmount]),
      )
    })

    it('reverts when approval is too low')
    it('reverts when not enough funds')
  })

  describe('withdrawTo', () => {})
})

async function setupTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2CrossDomainMessengerMock = await deployMock(
    'OVM_L2CrossDomainMessenger',
    { address: await signers.l2MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l2Dai = await deploy<Dai__factory>('Dai', [])
  const l2Minter = await deploy<L2ERC20Minter__factory>('L2ERC20Minter', [
    l2CrossDomainMessengerMock.address,
    l2Dai.address,
  ])
  const l1Erc20DepositMock = await deployMock('L1ERC20Deposit')

  await l2Dai.rely(l2Minter.address)
  await l2Minter.init(l1Erc20DepositMock.address)

  return { l2Dai, l1Erc20DepositMock, l2CrossDomainMessengerMock, l2Minter }
}

const INITIAL_TOTAL_L1_SUPPLY = 3000

async function setupWithdrawTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const contracts = await setupTest(signers)

  await contracts.l2Dai.mint(signers.user1.address, INITIAL_TOTAL_L1_SUPPLY)
  await contracts.l2Dai.connect(signers.user1).approve(contracts.l2Minter.address, ethers.constants.MaxUint256)

  return contracts
}
