import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton-community/sandbox';
import { Address, Cell, beginCell, toNano } from 'ton-core';
import { Fundraiser } from '../wrappers/Fundraiser';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { Helper } from '../wrappers/Helper';
import { randomAddress } from '@ton-community/test-utils';
import { Deployer } from '../wrappers/Deployer';

describe('Fundraiser with time block', () => {
    let code: Cell;
    let codeHelper: Cell;
    let codeDeployer: Cell;
    let codeJettonMinter: Cell;
    let codeJettonWallet: Cell;

    beforeAll(async () => {
        code = await compile('Fundraiser');
        codeHelper = await compile('Helper');
        codeDeployer = await compile('Deployer');
        codeJettonMinter = await compile('JettonMinter');
        codeJettonWallet = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let fundraiser: SandboxContract<Fundraiser>;
    let deployer: SandboxContract<Deployer>;
    let deployerWallet: SandboxContract<TreasuryContract>;
    let jetton1Minter: SandboxContract<JettonMinter>;
    let jetton2Minter: SandboxContract<JettonMinter>;
    let jetton3Minter: SandboxContract<JettonMinter>;
    let jetton4Minter: SandboxContract<JettonMinter>;
    let users: SandboxContract<TreasuryContract>[];
    let userWallets: SandboxContract<JettonWallet>[][];
    let feeReceiver: Address;
    let fundraiserJettonWallets: Address[] = [];

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;
        feeReceiver = randomAddress();

        deployerWallet = await blockchain.treasury('deployerWallet');

        jetton1Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(0, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton2Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(1, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton3Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(2, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton4Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(3, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        await jetton1Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
        await jetton2Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
        await jetton3Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
        await jetton4Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));

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
                    deployerWallet.getSender(),
                    toNano('0.05'),
                    toNano('0.01'),
                    users[i].address,
                    toNano('1000')
                );
            }
        }

        deployer = blockchain.openContract(
            Deployer.createFromConfig(
                {
                    admin: deployerWallet.address,
                    feePercentage: 100,
                    feeReceiver,
                    fundraiserCode: code,
                    helperCode: codeHelper,
                    index: 0n,
                    jettonWalletCode: codeJettonWallet,
                    collectionContent: beginCell().endCell(),
                },
                codeDeployer
            )
        );

        {
            const deployResult = await deployer.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
            expect(deployResult.transactions).toHaveTransaction({
                from: deployerWallet.address,
                to: deployer.address,
                deploy: true,
                success: true,
            });
        }

        fundraiser = blockchain.openContract(
            Fundraiser.createFromConfig(
                {
                    collection: deployer.address,
                    index: 0n,
                },
                code
            )
        );

        const deployResult = await deployer.sendDeployFundraiser(
            deployerWallet.getSender(),
            toNano('0.05'),
            123n,
            toNano('100'),
            2000n,
            'https://test.com/123.json',
            jetton1Minter.address
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: fundraiser.address,
            deploy: true,
            success: true,
        });

        jettonMinters.forEach(async (minter) => {
            fundraiserJettonWallets.push(await minter.getWalletAddressOf(fundraiser.address));
        });
    });

    it('should deploy', async () => {
        expect(await fundraiser.getActive()).toBeTruthy();
        expect(await fundraiser.getType()).toEqual(0);
        expect(await fundraiser.getBlockTime()).toEqual(2000);
        expect((await fundraiser.getTotal()).size).toEqual(0);
        expect(await fundraiser.getPriorityCoin()).toEqualAddress(jetton1Minter.address);
        expect(await fundraiser.getGoal()).toEqual(toNano('100'));
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

    it('should return if goal not reached', async () => {
        await commonDonate();
        expect(await userWallets[0][0].getJettonBalance()).toEqual(toNano('990'));
        blockchain.now = 3000;
        const result = await userWallets[0][0].sendTransfer(
            users[0].getSender(),
            toNano('0.15'),
            toNano('0.1'),
            fundraiser.address,
            toNano('10'),
            beginCell().storeUint(0, 32).endCell()
        );
        expect(await userWallets[0][0].getJettonBalance()).toEqual(toNano('990'));

        const total = await fundraiser.getTotal();
        expect(total.size).toEqual(2);
        expect(total.get(await jetton1Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('10'));
        expect(total.get(await jetton2Minter.getWalletAddressOf(fundraiser.address))).toEqual(toNano('20'));

        {
            const helper = blockchain.openContract(
                Helper.createFromAddress(await fundraiser.getHelperAddress(users[0].address))
            );
            const result = await helper.sendReturn(users[0].getSender(), toNano('0.5'), 123n);
            expect(result.transactions).toHaveTransaction({
                on: fundraiser.address,
                success: true,
            });
            expect(await userWallets[0][0].getJettonBalance()).toEqual(toNano('1000'));
        }
    });

    it('should not donate tokens after finish', async () => {
        blockchain.now = 3000;
        const result = await userWallets[0][0].sendTransfer(
            users[0].getSender(),
            toNano('0.15'),
            toNano('0.1'),
            fundraiser.address,
            toNano('15'),
            beginCell().storeUint(0, 32).endCell()
        );

        expect(await userWallets[0][0].getJettonBalance()).toEqual(toNano('1000'));

        const total = await fundraiser.getTotal();
        expect(total.size).toEqual(0);
    });

    it('should not claim until time passes', async () => {
        await commonDonate();
        const result = await fundraiser.sendClaim(
            deployerWallet.getSender(),
            toNano('0.5'),
            123n,
            fundraiserJettonWallets
        );

        expect(result.transactions).toHaveTransaction({
            on: fundraiser.address,
            exitCode: 702,
        });
    });

    it('should not claim until enough donates', async () => {
        await commonDonate();
        blockchain.now = 3000;
        const result = await fundraiser.sendClaim(
            deployerWallet.getSender(),
            toNano('0.5'),
            123n,
            fundraiserJettonWallets
        );
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
        const result = await fundraiser.sendClaim(
            deployerWallet.getSender(),
            toNano('0.5'),
            123n,
            fundraiserJettonWallets
        );
        expect(
            result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
        ).toHaveLength(4);

        expect(
            await blockchain
                .openContract(
                    JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployerWallet.address))
                )
                .getJettonBalance()
        ).toEqual(toNano('99'));
        expect(
            await blockchain
                .openContract(JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(feeReceiver)))
                .getJettonBalance()
        ).toEqual(toNano('1'));

        expect(
            await blockchain
                .openContract(
                    JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployerWallet.address))
                )
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
    let codeDeployer: Cell;
    let codeJettonMinter: Cell;
    let codeJettonWallet: Cell;

    beforeAll(async () => {
        code = await compile('Fundraiser');
        codeHelper = await compile('Helper');
        codeDeployer = await compile('Deployer');
        codeJettonMinter = await compile('JettonMinter');
        codeJettonWallet = await compile('JettonWallet');
    });

    let blockchain: Blockchain;
    let fundraiser: SandboxContract<Fundraiser>;
    let deployer: SandboxContract<Deployer>;
    let deployerWallet: SandboxContract<TreasuryContract>;
    let jetton1Minter: SandboxContract<JettonMinter>;
    let jetton2Minter: SandboxContract<JettonMinter>;
    let jetton3Minter: SandboxContract<JettonMinter>;
    let jetton4Minter: SandboxContract<JettonMinter>;
    let users: SandboxContract<TreasuryContract>[];
    let userWallets: SandboxContract<JettonWallet>[][];
    let feeReceiver: Address;
    let fundraiserJettonWallets: Address[] = [];

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        deployerWallet = await blockchain.treasury('deployerWallet');
        feeReceiver = randomAddress();

        jetton1Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(0, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton2Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(1, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton3Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(2, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        jetton4Minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployerWallet.address,
                    content: beginCell().storeUint(3, 8).endCell(),
                    walletCode: codeJettonWallet,
                },
                codeJettonMinter
            )
        );

        await jetton1Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
        await jetton2Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
        await jetton3Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
        await jetton4Minter.sendDeploy(deployerWallet.getSender(), toNano('0.05'));

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
                    deployerWallet.getSender(),
                    toNano('0.05'),
                    toNano('0.01'),
                    users[i].address,
                    toNano('1000')
                );
            }
        }

        deployer = blockchain.openContract(
            Deployer.createFromConfig(
                {
                    admin: deployerWallet.address,
                    feePercentage: 100,
                    feeReceiver,
                    fundraiserCode: code,
                    helperCode: codeHelper,
                    index: 0n,
                    jettonWalletCode: codeJettonWallet,
                    collectionContent: Cell.EMPTY,
                },
                codeDeployer
            )
        );

        {
            const deployResult = await deployer.sendDeploy(deployerWallet.getSender(), toNano('0.05'));
            expect(deployResult.transactions).toHaveTransaction({
                from: deployerWallet.address,
                to: deployer.address,
                deploy: true,
                success: true,
            });
        }

        {
            fundraiser = blockchain.openContract(
                Fundraiser.createFromConfig(
                    {
                        collection: deployer.address,
                        index: 0n,
                    },
                    code
                )
            );

            const deployResult = await deployer.sendDeployFundraiser(
                deployerWallet.getSender(),
                toNano('0.05'),
                123n,
                toNano('100'),
                2000n,
                'https://test.com/123.json',
                jetton1Minter.address
            );

            expect(deployResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: fundraiser.address,
                deploy: true,
                success: true,
            });
        }

        {
            fundraiser = blockchain.openContract(
                Fundraiser.createFromConfig(
                    {
                        collection: deployer.address,
                        index: 1n,
                    },
                    code
                )
            );

            const deployResult = await deployer.sendDeployFundraiser(
                deployerWallet.getSender(),
                toNano('0.05'),
                123n,
                toNano('100'),
                2000n,
                'https://test.com/123.json',
                jetton1Minter.address
            );

            expect(deployResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: fundraiser.address,
                deploy: true,
                success: true,
            });
        }

        {
            fundraiser = blockchain.openContract(
                Fundraiser.createFromConfig(
                    {
                        collection: deployer.address,
                        index: 2n,
                    },
                    code
                )
            );

            const deployResult = await deployer.sendDeployFundraiser(
                deployerWallet.getSender(),
                toNano('0.05'),
                123n,
                0n,
                0n,
                'https://test.com/123.json',
                jetton1Minter.address
            );

            expect(deployResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: fundraiser.address,
                deploy: true,
                success: true,
            });

            jettonMinters.forEach(async (minter) => {
                fundraiserJettonWallets.push(await minter.getWalletAddressOf(fundraiser.address));
            });
        }
    });

    it('should deploy', async () => {
        expect(await fundraiser.getActive()).toBeTruthy();
        expect(await fundraiser.getType()).toEqual(-1);
        expect(await fundraiser.getBlockTime()).toEqual(0);
        expect((await fundraiser.getTotal()).size).toEqual(0);
        expect(await fundraiser.getPriorityCoin()).toEqualAddress(jetton1Minter.address);
        expect(await fundraiser.getGoal()).toEqual(0n);
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
        blockchain.now = 3000;
        const result = await fundraiser.sendClaim(
            deployerWallet.getSender(),
            toNano('0.5'),
            123n,
            fundraiserJettonWallets
        );

        expect(
            result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
        ).toHaveLength(4);

        expect(
            await blockchain
                .openContract(
                    JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployerWallet.address))
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
                    JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployerWallet.address))
                )
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
            blockchain.now = 3000;
            const result = await fundraiser.sendClaim(
                deployerWallet.getSender(),
                toNano('0.5'),
                123n,
                fundraiserJettonWallets
            );

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(4);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployerWallet.address))
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
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployerWallet.address))
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
            const result = await fundraiser.sendClaim(
                deployerWallet.getSender(),
                toNano('0.5'),
                123n,
                fundraiserJettonWallets
            );

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(0);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployerWallet.address))
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
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployerWallet.address))
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

            const result = await fundraiser.sendClaim(
                deployerWallet.getSender(),
                toNano('0.5'),
                123n,
                fundraiserJettonWallets
            );

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(2);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployerWallet.address))
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
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployerWallet.address))
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

            const result = await fundraiser.sendClaim(
                deployerWallet.getSender(),
                toNano('0.5'),
                123n,
                fundraiserJettonWallets
            );

            expect(
                result.transactions.filter((t) => t.inMessage?.body.beginParse().loadUint(32) == 0x178d4519)
            ).toHaveLength(4);

            expect(
                await blockchain
                    .openContract(
                        JettonWallet.createFromAddress(await jetton1Minter.getWalletAddressOf(deployerWallet.address))
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
                        JettonWallet.createFromAddress(await jetton2Minter.getWalletAddressOf(deployerWallet.address))
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
