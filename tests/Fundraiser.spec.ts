import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
import { Fundraiser } from '../wrappers/Fundraiser';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';

describe('Fundraiser with time block', () => {
    let code: Cell;
    let codeHelper: Cell;
    let codeJettonMinter: Cell;
    let codeJettonWallet: Cell;

    beforeAll(async () => {
        code = await compile('Fundraiser');
        codeHelper = await compile('Helper');
        codeJettonMinter = await compile('JettonMinter');
        codeJettonWallet = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let fundraiser: SandboxContract<Fundraiser>;
    let deployer: SandboxContract<TreasuryContract>;
    let jetton1Minter: SandboxContract<JettonMinter>;
    let jetton2Minter: SandboxContract<JettonMinter>;
    let jetton3Minter: SandboxContract<JettonMinter>;
    let jetton4Minter: SandboxContract<JettonMinter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        deployer = await blockchain.treasury('deployer');

        jetton1Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(0, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton2Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(1, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton3Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(2, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton4Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(3, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        await jetton1Minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await jetton2Minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await jetton3Minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await jetton4Minter.sendDeploy(deployer.getSender(), toNano('0.05'));

        fundraiser = blockchain.openContract(
            Fundraiser.createFromConfig(
                {
                    admin: deployer.address,
                    blockTime: 2000n,
                    feePercentage: 100,
                    feeReceiver: deployer.address,
                    goal: toNano('100'),
                    helperCode: codeHelper,
                    metadataIpfsLink: 'https://test.com/123.json',
                },
                code
            )
        );

        const address = await jetton1Minter.getWalletAddressOf(fundraiser.address);

        const deployResult = await fundraiser.sendDeploy(deployer.getSender(), toNano('0.05'), 123n, address);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: fundraiser.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and fundraiser are ready to use
    });

    it('should donate tokens', async () => {});
});

describe('Fundraiser without time block', () => {
    let code: Cell;
    let codeHelper: Cell;
    let codeJettonMinter: Cell;
    let codeJettonWallet: Cell;

    beforeAll(async () => {
        code = await compile('Fundraiser');
        codeHelper = await compile('Helper');
        codeJettonMinter = await compile('JettonMinter');
        codeJettonWallet = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let fundraiser: SandboxContract<Fundraiser>;
    let deployer: SandboxContract<TreasuryContract>;
    let jetton1Minter: SandboxContract<JettonMinter>;
    let jetton2Minter: SandboxContract<JettonMinter>;
    let jetton3Minter: SandboxContract<JettonMinter>;
    let jetton4Minter: SandboxContract<JettonMinter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        deployer = await blockchain.treasury('deployer');

        jetton1Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(0, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton2Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(1, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton3Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(2, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton4Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    content: beginCell().storeUint(3, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        await jetton1Minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await jetton2Minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await jetton3Minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        await jetton4Minter.sendDeploy(deployer.getSender(), toNano('0.05'));

        fundraiser = blockchain.openContract(
            Fundraiser.createFromConfig(
                {
                    admin: deployer.address,
                    blockTime: 0n,
                    feePercentage: 100,
                    feeReceiver: deployer.address,
                    goal: 0n,
                    helperCode: codeHelper,
                    metadataIpfsLink: 'https://test.com/123.json',
                },
                code
            )
        );

        const deployResult = await fundraiser.sendDeploy(deployer.getSender(), toNano('0.05'), 123n);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: fundraiser.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and fundraiser are ready to use
    });

    it('should donate tokens', async () => {});
});
