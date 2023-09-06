import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';

export type FundraiserConfig = {};

export function fundraiserConfigToCell(config: FundraiserConfig): Cell {
    return beginCell().endCell();
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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
