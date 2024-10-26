import {
	Connection,
	PublicKey,
	Keypair,
	ParsedAccountData,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import withdrawController from "../controller/withdraw";
import * as Web3 from "@solana/web3.js";
import { web3 } from "@project-serum/anchor";
import { bot } from "../bot";
import crypto from "crypto";
import dotenv from "dotenv";
import {config }from '../../src/config'

dotenv.config();

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = config.salt
const IV_LENGTH = 12;
const connection = new Connection(config.rpcUrl);

export const withdrawService = async (withInfo: any) => {
	const privatekey = await decryptPrivateKey(withInfo.privateKey);
	if (withInfo.token === "So11111111111111111111111111111111111111112") {
		const r = await sendSol(
			withInfo.amount,
			withInfo.withdrawAddress,
			privatekey
		);
		if (r) {
			bot.sendMessage(
				withInfo.userId,
				`
<b>Please check this.</b>
<a href="https://solscan.io/tx/${r}"><i>View on Solscan</i></a>`,
				{
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Return  👈", callback_data: "return" }],
						],
					},
				}
			);

			await withdrawController.create(withInfo);
		} else {
			bot.sendMessage(
				withInfo.userId,
				`Withdraw failed. Please try again later`,
				{
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Return  👈", callback_data: "return" }],
						],
					},
				}
			);
		}
	} else {
		const r = await transferSplToken(
			privatekey,
			withInfo.token,
			withInfo.withdrawAddress,
			withInfo.amount
		);
		if (r) {
			bot.sendMessage(
				withInfo.userId,
				`
  <b>Please check this.</b>
  <a href="https://solscan.io/tx/${r}"><i>View on Solscan</i></a>`,
				{
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Return  👈", callback_data: "return" }],
						],
					},
				}
			);

			await withdrawController.create(withInfo);
		} else {
			bot.sendMessage(
				withInfo.userId,
				`Withdraw failed. Please try again later`,
				{
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Return  👈", callback_data: "return" }],
						],
					},
				}
			);
		}
	}
};
const sendSol = async (
	amount: number,
	toAddress: string,
	privatekey: string
) => {
	try {
		const sender = await getKeyPairFromPrivatekey(privatekey);
		const to = new PublicKey(toAddress);
		const decimals = 9;
		const transferAmountInDecimals = amount * Math.pow(10, decimals);

		let newNonceTx = new Web3.Transaction();
		const { blockhash, lastValidBlockHeight } =
			await connection.getLatestBlockhash();
		newNonceTx.feePayer = sender.publicKey;
		newNonceTx.recentBlockhash = blockhash;
		newNonceTx.lastValidBlockHeight = lastValidBlockHeight;

		newNonceTx.add(
			Web3.SystemProgram.transfer({
				fromPubkey: sender.publicKey,
				toPubkey: to,
				lamports: transferAmountInDecimals,
			})
		);

		const tx = await Web3.sendAndConfirmTransaction(
			connection,
			newNonceTx,
			[sender]
		);
		console.log(`Completed: https://explorer.solana.com/tx/${tx}`);
		return tx;
	} catch (err) {
		console.log(err);
		return null;
	}
};

const transferSplToken = async (
	privatekey: string,
	tokenAddr: string,
	dis: string,
	amount: number
) => {
	const fromWallet = await getKeyPairFromPrivatekey(privatekey);
	const destPublicKey = new PublicKey(dis);
	const mintPublicKey = new web3.PublicKey(tokenAddr);
	const decimals = await getNumberDecimals(mintPublicKey, connection);

	const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
		connection,
		fromWallet,
		mintPublicKey,
		fromWallet.publicKey
	);

	const receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
		connection,
		fromWallet,
		mintPublicKey,
		destPublicKey
	);

	const tx = await transfer(
		connection,
		fromWallet,
		senderTokenAccount.address,
		receiverTokenAccount.address,
		fromWallet.publicKey,
		amount * 10 ** decimals
	);
	return tx;
};

const getKeyPairFromPrivatekey = async (PRIVATE_KEY: any) => {
	const keypair = Keypair.fromSecretKey(Buffer.from(PRIVATE_KEY, "base64"));
	return keypair;
};

async function getNumberDecimals(
	mintAddress: PublicKey,
	connection: Connection
): Promise<number> {
	const info = await connection.getParsedAccountInfo(mintAddress);
	const decimals = (info.value?.data as ParsedAccountData).parsed.info
		.decimals as number;
	return decimals;
}

/**
 * Encrypts a private key before storing it in the database.
 * @param privateKey The private key to encrypt.
 * @returns The encrypted private key.
 */
export const encryptPrivateKey = (privateKey: string): string => {
	if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
		throw new Error(
			"Invalid encryption key length. Must be 32 characters."
		);
	}
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(
		ALGORITHM,
		Buffer.from(ENCRYPTION_KEY),
		iv
	);

	const encrypted = Buffer.concat([
		cipher.update(privateKey, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();

	return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

/**
 * Decrypts an encrypted private key stored in the database.
 * @param encryptedPrivateKey The encrypted private key to decrypt.
 * @returns The decrypted private key.
 */
export const decryptPrivateKey = (encryptedPrivateKey: string): string => {
	if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
		throw new Error(
			"Invalid encryption key length. Must be 32 characters."
		);
	}
	const encryptedBuffer = Buffer.from(encryptedPrivateKey, "base64");
	const iv = encryptedBuffer.slice(0, IV_LENGTH);
	const tag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + 16);
	const encryptedText = encryptedBuffer.slice(IV_LENGTH + 16);

	const decipher = crypto.createDecipheriv(
		ALGORITHM,
		Buffer.from(ENCRYPTION_KEY),
		iv
	);
	decipher.setAuthTag(tag);

	const decrypted = Buffer.concat([
		decipher.update(encryptedText),
		decipher.final(),
	]);

	return decrypted.toString("utf8");
};
