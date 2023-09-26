import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton/sandbox';
import { Address, Cell, beginCell, toNano } from '@ton/core';
import { Fundraiser } from '../wrappers/Fundraiser';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { Helper } from '../wrappers/Helper';
import { randomAddress } from '@ton/test-utils';

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
    let feeReceiver: Address;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;
        feeReceiver = randomAddress();

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
                    feeReceiver,
                    goal: toNano('100'),
                    helperCode: codeHelper,
                    metadataIpfsLink: 'https://test.com/123.json',
                },
                code
            )
        );

        const deployResult = await fundraiser.sendDeploy(
            deployer.getSender(),
            toNano('0.05'),
            123n,
            await jetton1Minter.getWalletAddressOf(fundraiser.address)
        );

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

    async function commonDonate() {
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
            expect(userTotal.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(1);
            expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
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
            expect(userTotal.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
            expect(userTotal.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('5'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
            expect(total.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('5'));
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
            expect(userTotal.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('15'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
            expect(total.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('20'));
        }
    }

    it('should donate tokens', commonDonate);

    it('should not donate tokens after finish', async () => {
        blockchain.now = 3000;
        const result = await userWallets[0][0].sendTransfer(
            users[0].getSender(),
            toNano('0.1'),
            toNano('0.05'),
            fundraiser.address,
            toNano('15'),
            beginCell().storeUint(0, 32).endCell()
        );

        expect(result.transactions).toHaveTransaction({
            on: fundraiser.address,
            exitCode: 706,
        });

        const total = await fundraiser.getTotal();
        expect(total.size).toEqual(0);
    });

    it('should not claim until time passes', async () => {
        await commonDonate();
        const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

        expect(result.transactions).toHaveTransaction({
            on: fundraiser.address,
            exitCode: 702,
        });
    });

    it('should not claim until enough donates', async () => {
        await commonDonate();
        blockchain.now = 3000;
        const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

        expect(result.transactions).toHaveTransaction({
            on: fundraiser.address,
            exitCode: 703,
        });
    });

    it('should claim', async () => {
        await commonDonate();
        await userWallets[2][0].sendTransfer(
            users[2].getSender(),
            toNano('0.1'),
            toNano('0.05'),
            fundraiser.address,
            toNano('90'),
            beginCell().storeUint(0, 32).endCell()
        );
        blockchain.now = 3000;
        const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);
        expect(
            result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
        ).toHaveLength(4);

        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployer.address)))
                .getJettonBalance()
        ).toEqual(toNano('99'));
        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                .getJettonBalance()
        ).toEqual(toNano('1'));

        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployer.address)))
                .getJettonBalance()
        ).toEqual(toNano('19.8'));
        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(feeReceiver)))
                .getJettonBalance()
        ).toEqual(toNano('0.2'));
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
    let feeReceiver: Address;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        deployer = await blockchain.treasury('deployer');
        feeReceiver = randomAddress();

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
                    feeReceiver,
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

    async function commonDonate() {
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
            expect(userTotal.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(1);
            expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
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
            expect(userTotal.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
            expect(userTotal.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('5'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
            expect(total.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('5'));
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
            expect(userTotal.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('15'));

            const total = await fundraiser.getTotal();
            expect(total.size).toEqual(2);
            expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
            expect(total.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('20'));
        }
    }

    it('should donate tokens', commonDonate);

    it('should claim', async () => {
        await commonDonate();
        const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

        expect(
            result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
        ).toHaveLength(4);

        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployer.address)))
                .getJettonBalance()
        ).toEqual(toNano('9.9'));
        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                .getJettonBalance()
        ).toEqual(toNano('0.1'));

        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployer.address)))
                .getJettonBalance()
        ).toEqual(toNano('19.8'));
        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(feeReceiver)))
                .getJettonBalance()
        ).toEqual(toNano('0.2'));
    });

    it('should claim multiple times', async () => {
        {
            await commonDonate();
            const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(4);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('9.9'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.1'));

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('19.8'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.2'));
        }

        {
            const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(0);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('9.9'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.1'));

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('19.8'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.2'));
        }

        {
            await userWallets[0][0].sendTransfer(
                users[0].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('20'),
                beginCell().storeUint(0, 32).endCell()
            );

            const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(2);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('29.7'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.3'));

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('19.8'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.2'));
        }

        {
            await userWallets[0][0].sendTransfer(
                users[0].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('10'),
                beginCell().storeUint(0, 32).endCell()
            );
            await userWallets[1][1].sendTransfer(
                users[1].getSender(),
                toNano('0.1'),
                toNano('0.05'),
                fundraiser.address,
                toNano('10'),
                beginCell().storeUint(0, 32).endCell()
            );

            const result = await fundraiser.sendClaim(deployer.getSender(), toNano('0.5'), 123n);

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(4);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('39.6'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.4'));

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployer.address))
                    )
                    .getJettonBalance()
            ).toEqual(toNano('29.7'));
            expect(
                await blockchain
                    .openContract(JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(feeReceiver)))
                    .getJettonBalance()
            ).toEqual(toNano('0.3'));
        }

        const total = await fundraiser.getTotal();
        expect(total.size).toEqual(2);
        expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('40'));
        expect(total.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('30'));
    });
});
