import { Address, toNano } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { Deployer } from '../wrappers/Deployer';

export async function run(provider: NetworkProvider) {
    const deployer = provider.open(Deployer.createFromAddress(Address.parse('')));

    await deployer.sendDeployFundraiser(
        provider.sender(),
        toNano('0.05'),
        123n,
        toNano('100'),
        1600000000n,
        'ipfs://qwe',
        Address.parse('')
    );
}
