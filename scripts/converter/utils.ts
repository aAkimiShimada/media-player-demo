// ここでは、各種ユーティリティを実装している

import { showCommands, dryRun } from "./consts";
import {
	spawn,
	type SpawnOptionsWithoutStdio as ExecOption
} from "node:child_process";

/** 実行したシェルの終了状態を説明する */
export namespace Status {
	/** 正常に終了した場合 */
	export const Success = "success";
	/** 0でない終了コードで終了した場合 */
	export const Failure = "failure";
	/** シグナルを受けて終了した場合 */
	export const Signaled = "signaled";
	/** こちらから強制終了させた場合 */
	export const Aborted = "aborted";
	/** 実行がそもそも開始しなかった場合 */
	export const NotStarted = "not-started";
	/** 他に何かしらのエラーが発生して終了した場合 */
	export const Error = "error";
	/** シェルの終了状態を表す型 */
	export type Type =
		typeof Success | typeof Failure | typeof Signaled | typeof Aborted | typeof NotStarted | typeof Error;
}

/** コマンドを実行する `exec` 関数の出力 */
export interface ExecOutput {
	/**
	 * 終了したら解決される `Promise`
	 *
	 * 終了状態を必ず返すため、 `reject` されることはない
	 */
	promise: Promise<Status.Type>;
	/**
	 * シェルの実行が終了したかどうかを表す真偽値を返す
	 */
	exited: () => boolean;
	/**
	 * シェルを強制終了させる
	 *
	 * 最初は `SIGINT` 、1秒後に `SIGTERM` 、5秒後に `SIGKILL` を送信します。
	 */
	abort: () => Promise<void>;
}

/**
 * コマンドを実行する
 * * 第1引数: 引数を `string[]` の形式で指定する
 * * 戻り値: オブジェクト
 *     * `promise`: 終了したら解決する `Promise` で、 `Status.Type` による終了状態を返す
 *     * `exited`: `() => boolean` であり、終了したかどうかをブール値で返す
 *     * `abort`: `() => void` であり、プロセスを強制終了させる
 */
export const exec = (
	command: string[],
	options?: ExecOption | undefined
): ExecOutput => {

	// コマンド引数の数が足りていない場合はエラーとする
	if (command.length === 0) {
		return {
			promise: Promise.resolve().then(() => Status.NotStarted),
			exited: () => true, abort: async () => {}
		};
	}

	/** 実行が開始したかどうかを表すブール値 */
	let isStarted: boolean = false;
	/** 実行が終了したかどうかを表すブール値 */
	let isExited: boolean = false;
	/** ユーザ操作で終了させたかどうかを表すブール値 */
	let isAborted: boolean = false;

	// 実行内容を出力する設定の場合は出力する
	if (showCommands || dryRun) {
		// コマンドライン引数を一つに繋げた文字列を生成する
		const commandStr = getCommandStr(command);
		console.log(`> ${commandStr}`);
	}

	// 実際に実行しない場合は、即時に終了したものとして返す
	if (dryRun) {
		return {
			promise: Promise.resolve().then(_ => Status.Success),
			exited: () => true,
			abort: () => Promise.resolve()
		}
	}

	// プロセスを起動する
	const process = spawn(
		command[0],
		command.slice(1),
		options
	);

	// プロセスが開始した際に呼び出されるイベント
	process.addListener("spawn", () => {
		isStarted = true;
	});

	/** 実行が終了したら解決する `Promise` を用意する */
	const promise: Promise<Status.Type> = new Promise(resolve => {

		// エラーで終了した場合に呼び出されるイベント
		process.addListener("error", () => {
			isExited = true;
			// そもそも開始しなかった場合
			if (!isStarted) resolve(Status.NotStarted);
			// 開始したけど他の理由でエラーになった場合
			else resolve(Status.Error);
		});

		// 実行が終了した場合に呼び出されるイベント
		process.addListener("exit", (code, signal) => {
			isExited = true;
			// こちらから終了させた場合
			if (isAborted) {
				resolve(Status.Aborted);
				return;
			}
			// シグナル終了した場合
			if ((signal != null) || (code == null)) {
				resolve(Status.Signaled);
				return;
			}
			// 終了コードが0でない場合
			if (code != 0) {
				resolve(Status.Failure);
				return;
			}
			resolve(Status.Success);
		});

	});

	// 強制終了の処理
	const abort: ExecOutput["abort"] = () => {
		// まずフラグを建てる
		isAborted = true;

		// タイムアウトのインデクスを管理する
		// `setTimeout` の戻り値の型は通常 `number` なのだが、一部の環境では `NodeJS.Timeout` などのように別の型になっている場合があるので、あえて `Timeout` という型をここで導入している。
		type Timeout = ReturnType<typeof setTimeout>;
		let timeout: Timeout | null = null;

		return new Promise(resolve => {

			// 終了の監視を行う
			process.addListener("exit", () => {
				// タイムアウトは無効化する
				if (timeout != null) {
					clearTimeout(timeout);
					timeout = null;
				}
				resolve();
			});

			// 第1ステップとして SIGINT を送る
			process.kill("SIGINT");

			// 第2ステップとして SIGTERM を送る
			timeout = setTimeout(() => {
				timeout = null;
				process.kill("SIGTERM");

				// 第3ステップとして SIGKILL を送る
				timeout = setTimeout(() => {
					timeout = null;
					process.kill("SIGKILL");
				}, 5000);

			}, 1000);

		});
	};

	return {
		promise, abort,
		exited: () => isExited
	};
};

/**
 * コマンドライン引数を表す `string[]` 型のデータを、ターミナルで実行可能な形式として繋がった単一の `string` を返す
 *
 * この時に引数にスペースなどが入っている場合はわかりやすく変換する
 */
const getCommandStr = (command: string[]): string => {
	return command.map(arg => {
		if (/[ "\\]/.test(arg)) {
			const escaped =
				arg
				.replace(/\\/, "\\\\")
				.replace(/"/g, "\\\"");
			return `"${escaped}"`;
		}
		else return arg;
	}).join(" ");
};

/** 暗号化キーのペアを表す型 */
export interface KeyPair {
	/** 16進数の形で指定されたキーID */
	keyId: string;
	/** 16進数の形で指定されたキー */
	key: string;
};

/**
 * 暗号化キーを規定する型
 *
 * 映像部分と音声部分で別々にキーペアが指定できるようになっている。 (以後の実装を見ると明らかだが、映像と音声を逆に指定しても特に問題は発生しない)
 */
export interface EncryptionKeys {
	/** 映像部分の暗号化キーペア */
	video: KeyPair;
	/** 音声部分の暗号化キーペア */
	audio: KeyPair;
};