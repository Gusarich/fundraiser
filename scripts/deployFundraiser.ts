import { Address, toNano } from 'ton-core';
import { NetworkProvider } from '@ton-community/blueprint';
import { Deployer } from '../wrappers/Deployer';

export async function run(provider: NetworkProvider) {
    const deployer = provider.open(
        Deployer.createFromAddress(Address.parse('EQB03iEdepUdHmJFOftOtCMxyFCUkGJ0ZcM5XZzEYvIcSKJi'))
    );

    await deployer.sendDeployFundraiser(
        provider.sender(),
        toNano('0.05'),
        123n,
        toNano('100'),
        1600000000n,
        'ipfs://qwe',
        Address.parse('EQBlqsm144Dq6SjbPI4jjZvA1hqTIP3CvHovbIfW_t-SCALE')
    );
}
