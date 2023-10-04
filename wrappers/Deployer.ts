import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type DeployerConfig = {
    admin: Address;
    feeReceiver: Address;
    feePercentage: number;
    fundraiserCode: Cell;
    helperCode: Cell;
    index: bigint;
    jettonWalletCode: Cell;
    collectionContent: Cell;
};

export function deployerConfigToCell(config: DeployerConfig): Cell {
    return beginCell()
        .storeAddress(config.admin)
        .storeAddress(config.feeReceiver)
        .storeUint(config.feePercentage, 16)
        .storeRef(config.fundraiserCode)
        .storeRef(config.helperCode)
        .storeUint(config.index, 64)
        .storeRef(config.jettonWalletCode)
        .storeRef(config.collectionContent)
        .endCell();
}

export class Deployer implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Deployer(address);
    }

    static createFromConfig(config: DeployerConfig, code: Cell, workchain = 0) {
        const data = deployerConfigToCell(config);
        const init = { code, data };
        return new Deployer(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendDeployFundraiser(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        queryId: bigint,
        goal: bigint,
        blockTime: bigint,
        metadataIpfsLink: string,
        priorityCoin?: Address
    ) {
        await provider.internal(via, {
            value,
            body: beginCell()
                .storeUint(0xc6aa753, 32)
                .storeUint(queryId, 64)
                .storeCoins(goal)
                .storeUint(blockTime, 64)
                .storeAddress(priorityCoin)
                .storeRef(beginCell().storeStringTail(metadataIpfsLink).endCell())
                .endCell(),
        });
    }
}
