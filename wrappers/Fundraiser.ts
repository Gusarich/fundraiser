import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Dictionary,
    Sender,
    SendMode,
} from '@ton/core';

export type FundraiserConfig = {
    admin: Address;
    goal: bigint;
    current?: Dictionary<Address, bigint>;
    blockTime: bigint;
    priorityCoin?: Address;
    metadataIpfsLink: string;
    feeReceiver: Address;
    feePercentage: number;
    helperCode: Cell;
};

export function fundraiserConfigToCell(config: FundraiserConfig): Cell {
    return beginCell()
        .storeAddress(config.admin)
        .storeCoins(config.goal)
        .storeDict(config.current)
        .storeUint(config.blockTime, 64)
        .storeAddress(config.priorityCoin)
        .storeRef(beginCell().storeStringTail(config.metadataIpfsLink).endCell())
        .storeAddress(config.feeReceiver)
        .storeUint(config.feePercentage, 16)
        .storeUint(0, 1)
        .storeRef(config.helperCode)
        .endCell();
}

export class Fundraiser implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Fundraiser(address);
    }

    static createFromConfig(config: FundraiserConfig, code: Cell, workchain = 0) {
        const data = fundraiserConfigToCell(config);
        const init = { code, data };
        return new Fundraiser(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint, queryId: bigint, priorityCoin?: Address) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0x2f8f4e56, 32).storeUint(queryId, 64).storeAddress(priorityCoin).endCell(),
        });
    }

    async sendClaim(provider: ContractProvider, via: Sender, value: bigint, queryId: bigint) {
        await provider.internal(via, {
            value,
            body: beginCell().storeUint(0x4d0c099d, 32).storeUint(queryId, 64).endCell(),
        });
    }

    async getActive(provider: ContractProvider): Promise<boolean> {
        return Boolean((await provider.get('get_active', [])).stack.readNumber());
    }

    async getType(provider: ContractProvider): Promise<number> {
        return (await provider.get('get_type', [])).stack.readNumber();
    }

    async getBlockTime(provider: ContractProvider): Promise<number> {
        return (await provider.get('get_block_time', [])).stack.readNumber();
    }

    async getTotal(provider: ContractProvider): Promise<Dictionary<Address, bigint>> {
        return (await provider.get('get_total', [])).stack
            .readCell()
            .beginParse()
            .loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.BigVarUint(16));
    }

    async getHelperAddress(provider: ContractProvider, user: Address): Promise<Address> {
        return (
            await provider.get('get_helper_address', [
                { type: 'slice', cell: beginCell().storeAddress(user).endCell() },
            ])
        ).stack.readAddress();
    }
}
