import { Address, beginCell, toNano } from 'ton-core';
import { Deployer } from '../wrappers/Deployer';
import { compile, NetworkProvider } from '@ton-community/blueprint';

export async function run(provider: NetworkProvider) {
    const deployer = provider.open(
        Deployer.createFromConfig(
            {
                admin: Address.parse('EQBIhPuWmjT7fP-VomuTWseE8JNWv2q7QYfsVQ1IZwnMk8wL'),
                feeReceiver: Address.parse('EQBIhPuWmjT7fP-VomuTWseE8JNWv2q7QYfsVQ1IZwnMk8wL'),
                feePercentage: 100,
                fundraiserCode: await compile('Fundraiser'),
                helperCode: await compile('Helper'),
                index: 0n,
                jettonWalletCode: await compile('JettonWallet'),
                collectionContent: beginCell().storeUint(1, 8).endCell(),
            },
            await compile('Deployer')
        )
    );

    await deployer.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(deployer.address);
}
