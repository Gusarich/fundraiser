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

export type HelperConfig = {
    fundraiser: Address;
    user: Address;
    current?: Dictionary<Address, bigint>;
};

export function helperConfigToCell(config: HelperConfig): Cell {
    return beginCell().storeAddress(config.fundraiser).storeAddress(config.user).storeDict(config.current).endCell();
}

export class Helper implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Helper(address);
    }

    static createFromConfig(config: HelperConfig, code: Cell, workchain = 0) {
        const data = helperConfigToCell(config);
        const init = { code, data };
        return new Helper(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendReturn(provider: ContractProvider, via: Sender, value: bigint, queryId: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(0xee54921, 32).storeUint(queryId, 64).endCell(),
        });
    }

    async getTotal(provider: ContractProvider): Promise<Dictionary<Address, bigint>> {
        return (await provider.get('get_total', [])).stack
            .readCell()
            .beginParse()
            .loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.BigVarUint(16));
    }
}
