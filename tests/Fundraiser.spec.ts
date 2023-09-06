import { Blockchain, SandboxContract } from '@ton-community/sandbox';
import { Cell, toNano } from 'ton-core';
import { Fundraiser } from '../wrappers/Fundraiser';
import '@ton-community/test-utils';
import { compile } from '@ton-community/blueprint';

describe('Fundraiser', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Fundraiser');
    });

    let blockchain: Blockchain;
    let fundraiser: SandboxContract<Fundraiser>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        fundraiser = blockchain.openContract(Fundraiser.createFromConfig({}, code));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await fundraiser.sendDeploy(deployer.getSender(), toNano('0.05'));

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
});
