import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Dictionary, Sender } from 'ton-core';

export type FundraiserConfig = {
    collection: Address;
    index: bigint;
};

export function fundraiserConfigToCell(config: FundraiserConfig): Cell {
    return beginCell().storeAddress(config.collection).storeUint(config.index, 64).endCell();
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
        const total = (await provider.get('get_total', [])).stack.readCellOpt();
        if (!total) {
            return Dictionary.empty(Dictionary.Keys.Address(), Dictionary.Values.BigVarUint(4));
        }
        return total.beginParse().loadDictDirect(Dictionary.Keys.Address(), Dictionary.Values.BigVarUint(4));
    }

    async getHelperAddress(provider: ContractProvider, user: Address): Promise<Address> {
        return (
            await provider.get('get_helper_address', [
                { type: 'slice', cell: beginCell().storeAddress(user).endCell() },
            ])
        ).stack.readAddress();
    }
}
