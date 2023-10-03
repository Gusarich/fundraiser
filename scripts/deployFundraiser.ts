import { toNano } from '@ton/core';
import { Fundraiser } from '../wrappers/Fundraiser';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const fundraiser = provider.open(Fundraiser.createFromConfig({}, await compile('Fundraiser')));
    await fundraiser.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(fundraiser.address);
}
