import { toNano } from '@ton/core';
import { Deployer } from '../wrappers/Deployer';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const deployer = provider.open(Deployer.createFromConfig({}, await compile('Deployer')));

    await deployer.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(deployer.address);

    // run methods on `deployer`
}
