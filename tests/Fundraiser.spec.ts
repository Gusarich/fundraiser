import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, beginCell, toNano } from '@ton/core';
import { Fundraiser } from '../wrappers/Fundraiser';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { Helper } from '../wrappers/Helper';

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
    let users: SandboxContract<TreasuryContract>[];
    let userWallets: SandboxContract<JettonWallet>[][];

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

        const jettonMinters = [jetton1Minter, jetton2Minter, jetton3Minter, jetton4Minter];

        users = await blockchain.createWallets(5);
        userWallets = [];
        for (let i = 0; i < 5; i++) {
            userWallets.push([]);
            for (let j = 0; j < 4; j++) {
                userWallets[i].push(
                    blockchain.openContract(
                        JettonWallet.createFromAddress(await jettonMinters[j].getWalletAddressOf(users[i].address))
                    )
                );
                await jettonMinters[j].sendMint(
                    deployer.getSender(),
                    toNano('0.05'),
                    toNano('0.01'),
                    users[i].address,
                    toNano('1000')
                );
            }
        }

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

        const deployResult = await fundraiser.sendDeploy(deployer.getSender(), toNano('0.05'), 123n);

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: fundraiser.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        expect(await fundraiser.getActive()).toBeTruthy();
        expect(await fundraiser.getType()).toEqual(0);
        expect(await fundraiser.getBlockTime()).toEqual(2000);
        expect((await fundraiser.getTotal()).size).toEqual(0);
    });

    it('should donate tokens', async () => {
        {
            const result = await userWallets[0][0].sendTransfer(
                users[0].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('10'),
                beginCell().storeUint(0, 32).endCell()
            );

            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });

            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[0].address))
            );

            expect(result.transactions).toHaveTransaction({
                from: fundraiser.address,
                to: helper.address,
                success: true,
            });

            const userTotal = await helper.getTotal();
            expect(userTotal.size).toEqual(1);
            expect(userTotal.values()[0]).toEqual(toNano('10'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(1);
            expect(total.values()[0]).toEqual(toNano('10'));
        }

        {
            const result = await userWallets[0][1].sendTransfer(
                users[0].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('5'),
                beginCell().storeUint(0, 32).endCell()
            );

            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });

            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[0].address))
            );

            expect(result.transactions).toHaveTransaction({
                from: fundraiser.address,
                to: helper.address,
                success: true,
            });

            const userTotal = await helper.getTotal();
            expect(userTotal.size).toEqual(2);
            expect(userTotal.values()[0]).toEqual(toNano('10'));
            expect(userTotal.values()[1]).toEqual(toNano('5'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.values()[0]).toEqual(toNano('10'));
            expect(total.values()[1]).toEqual(toNano('5'));
        }

        {
            const result = await userWallets[1][1].sendTransfer(
                users[1].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('15'),
                beginCell().storeUint(0, 32).endCell()
            );

            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });

            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[1].address))
            );

            expect(result.transactions).toHaveTransaction({
                from: fundraiser.address,
                to: helper.address,
                success: true,
            });

            const userTotal = await helper.getTotal();
            expect(userTotal.size).toEqual(1);
            expect(userTotal.values()[0]).toEqual(toNano('15'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.values()[0]).toEqual(toNano('10'));
            expect(total.values()[1]).toEqual(toNano('20'));
        }
    });
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
    let users: SandboxContract<TreasuryContract>[];
    let userWallets: SandboxContract<JettonWallet>[][];

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

        const jettonMinters = [jetton1Minter, jetton2Minter, jetton3Minter, jetton4Minter];

        users = await blockchain.createWallets(5);
        userWallets = [];
        for (let i = 0; i < 5; i++) {
            userWallets.push([]);
            for (let j = 0; j < 4; j++) {
                userWallets[i].push(
                    blockchain.openContract(
                        JettonWallet.createFromAddress(await jettonMinters[j].getWalletAddressOf(users[i].address))
                    )
                );
                await jettonMinters[j].sendMint(
                    deployer.getSender(),
                    toNano('0.05'),
                    toNano('0.01'),
                    users[i].address,
                    toNano('1000')
                );
            }
        }

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
        expect(await fundraiser.getActive()).toBeTruthy();
        expect(await fundraiser.getType()).toEqual(-1);
        expect(await fundraiser.getBlockTime()).toEqual(0);
        expect((await fundraiser.getTotal()).size).toEqual(0);
    });

    it('should donate tokens', async () => {
        {
            const result = await userWallets[0][0].sendTransfer(
                users[0].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('10'),
                beginCell().storeUint(0, 32).endCell()
            );

            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });

            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[0].address))
            );

            expect(result.transactions).toHaveTransaction({
                from: fundraiser.address,
                to: helper.address,
                success: true,
            });

            const userTotal = await helper.getTotal();
            expect(userTotal.size).toEqual(1);
            expect(userTotal.values()[0]).toEqual(toNano('10'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(1);
            expect(total.values()[0]).toEqual(toNano('10'));
        }

        {
            const result = await userWallets[0][1].sendTransfer(
                users[0].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('5'),
                beginCell().storeUint(0, 32).endCell()
            );

            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });

            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[0].address))
            );

            expect(result.transactions).toHaveTransaction({
                from: fundraiser.address,
                to: helper.address,
                success: true,
            });

            const userTotal = await helper.getTotal();
            expect(userTotal.size).toEqual(2);
            expect(userTotal.values()[0]).toEqual(toNano('10'));
            expect(userTotal.values()[1]).toEqual(toNano('5'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.values()[0]).toEqual(toNano('10'));
            expect(total.values()[1]).toEqual(toNano('5'));
        }

        {
            const result = await userWallets[1][1].sendTransfer(
                users[1].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('15'),
                beginCell().storeUint(0, 32).endCell()
            );

            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });

            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[1].address))
            );

            expect(result.transactions).toHaveTransaction({
                from: fundraiser.address,
                to: helper.address,
                success: true,
            });

            const userTotal = await helper.getTotal();
            expect(userTotal.size).toEqual(1);
            expect(userTotal.values()[0]).toEqual(toNano('15'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.values()[0]).toEqual(toNano('10'));
            expect(total.values()[1]).toEqual(toNano('20'));
        }
    });
});
