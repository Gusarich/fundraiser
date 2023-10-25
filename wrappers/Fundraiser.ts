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

    async sendClaim(provider: ContractProvider, via: Sender, value: bigint, queryId: bigint, tokens: Address[]) {
        let tokensDict = Dictionary.empty(Dictionary.Keys.Uint(32), Dictionary.Values.Address());
        for (let i = 0; i < tokens.length; i++) {
            tokensDict.set(i, tokens[i]);
        }
        await provider.internal(via, {
            value,
            body: beginCell().storeUint(0x128146f9, 32).storeUint(queryId, 64).storeDict(tokensDict).endCell(),
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

    async getCurrent(provider: ContractProvider): Promise<Dictionary<Address, bigint>> {
        const total = (await provider.get('get_current', [])).stack.readCellOpt();
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

    async getPriorityCoin(provider: ContractProvider): Promise<Address> {
        return (await provider.get('get_priority_coin', [])).stack.readAddress();
    }

    async getGoal(provider: ContractProvider): Promise<bigint> {
        return (await provider.get('get_goal', [])).stack.readBigNumber();
    }
}
