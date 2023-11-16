import { PublicKey } from '@solana/web3.js';
import 'dotenv/config'

export class Config {
    readonly rpcUrl: string;
    readonly wallet: PublicKey;
    constructor() {
        if (!process.env.SOLANA_RPC_URL) {
            throw new Error("SOLANA_RPC_URL is not defined");
        }
        this.rpcUrl = process.env.SOLANA_RPC_URL;
        if (!process.env.wallet) {
            throw new Error("wallet is not defined");
        }
        this.wallet = new PublicKey(process.env.wallet);
    }
}